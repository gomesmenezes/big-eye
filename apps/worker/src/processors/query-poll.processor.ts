import type { Job } from 'bullmq';

import { QueryStatus } from '@big-eye/core/db/prisma-client';
import { lockQuery } from '@big-eye/core/queries/query-lock';
import type { QueryPollJob } from '@big-eye/core/queues/queues';

import type { WorkerDependencies } from './context.js';
import { assertResult } from './query-run.processor.js';
import {
  errorCodeFor,
  finishWithFailure,
  finishWithResult,
} from './query-support.js';

function jobData(job: QueryPollJob | Job<QueryPollJob>): QueryPollJob {
  return 'data' in job ? job.data : job;
}

function pollDelay(dependencies: WorkerDependencies, attempt: number): number {
  const exponential = dependencies.initialPollDelayMs * 2 ** Math.max(0, attempt);
  return Math.min(exponential, dependencies.maxPollDelayMs);
}

export class QueryPollProcessor {
  constructor(private readonly dependencies: WorkerDependencies) {}

  async process(job: QueryPollJob | Job<QueryPollJob>): Promise<void> {
    const data = jobData(job);
    const query = await this.dependencies.prisma.query.findUnique({
      where: { id: data.queryId },
      select: {
        status: true,
        moduleSlug: true,
        providerRequestId: true,
        attempts: true,
        startedAt: true,
      },
    });

    if (!query || query.status !== QueryStatus.running) {
      return;
    }

    const requestId = data.requestId ?? query.providerRequestId;
    if (!requestId) {
      await finishWithFailure(this.dependencies, data.queryId, {
        code: 'QUERY_FAILED',
      }, {
        startedAt: query.startedAt,
      });
      return;
    }

    // A delayed poll can outlive a retry, reconciliation, or another
    // accepted provider request. Never poll a request that is no longer the
    // one persisted on the query.
    if (query.providerRequestId !== requestId) {
      return;
    }

    const attempt = Math.max(data.attempt, query.attempts) + 1;

    try {
      const providerResult = await this.dependencies.provider.poll(requestId);

      if (providerResult.kind === 'accepted') {
        if (attempt >= this.dependencies.maxPollAttempts) {
          await finishWithFailure(this.dependencies, data.queryId, {
            code: 'PROVIDER_UNAVAILABLE',
          }, {
            startedAt: query.startedAt,
            providerRequestId: requestId,
          });
          return;
        }

        await this.saveAttemptAndSchedule(
          data.queryId,
          providerResult.requestId,
          attempt,
          query.startedAt,
        );
        return;
      }

      const result = assertResult(query.moduleSlug, providerResult);
      await finishWithResult(this.dependencies, data.queryId, result, {
        startedAt: query.startedAt,
        providerRequestId: requestId,
      });
    } catch (error) {
      const code = errorCodeFor(error);

      // A malformed provider payload is a terminal technical failure. The
      // credit is returned immediately, while transient provider errors get
      // bounded exponential retries.
      if (code === 'QUERY_FAILED' || attempt >= this.dependencies.maxPollAttempts) {
        await finishWithFailure(this.dependencies, data.queryId, error, {
          startedAt: query.startedAt,
          providerRequestId: requestId,
        });
        return;
      }

      await this.saveAttemptAndSchedule(
        data.queryId,
        requestId,
        attempt,
        query.startedAt,
      );
    }
  }

  private async saveAttemptAndSchedule(
    queryId: string,
    requestId: string,
    attempt: number,
    expectedStartedAt: Date | null,
  ): Promise<void> {
    const delayMs = pollDelay(this.dependencies, attempt);
    const nextPollAt = new Date(this.dependencies.now().getTime() + delayMs);

    const shouldEnqueue = await this.dependencies.prisma.$transaction(async (tx) => {
      await lockQuery(tx, queryId);
      const query = await tx.query.findUnique({
        where: { id: queryId },
        select: { status: true, providerRequestId: true, startedAt: true },
      });

      if (
        !query ||
        query.status !== QueryStatus.running ||
        query.providerRequestId !== requestId ||
        query.startedAt?.getTime() !== expectedStartedAt?.getTime()
      ) {
        return false;
      }

      await tx.query.update({
        where: { id: queryId },
        data: {
          providerRequestId: requestId,
          attempts: attempt,
          nextPollAt,
        },
      });

      return true;
    });

    if (!shouldEnqueue) {
      return;
    }

    await this.dependencies.pollQueue.add(
      'query:poll',
      { queryId, requestId, attempt },
      { jobId: `${queryId}:poll:${attempt}`, delay: delayMs },
    );
  }
}

export function createQueryPollProcessor(
  dependencies: WorkerDependencies,
): (job: Job<QueryPollJob>) => Promise<void> {
  const processor = new QueryPollProcessor(dependencies);
  return (job) => processor.process(job);
}
