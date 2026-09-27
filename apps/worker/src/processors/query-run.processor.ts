import type { Job } from 'bullmq';

import { getModule } from '@big-eye/contracts';
import { QueryStatus } from '@big-eye/core/db/prisma-client';
import type { ProviderResult } from '@big-eye/core/provider/provider.client';
import type { QueryRunJob } from '@big-eye/core/queues/queues';

import type { WorkerDependencies } from './context.js';
import {
  asInputRecord,
  errorCodeFor,
  finishWithFailure,
  finishWithResult,
  markRunning,
} from './query-support.js';

class InvalidProviderResultError extends Error {
  readonly code = 'QUERY_FAILED' as const;

  constructor() {
    super('A resposta do provedor não corresponde ao contrato do módulo.');
    this.name = 'InvalidProviderResultError';
  }
}

function jobData(job: QueryRunJob | Job<QueryRunJob>): QueryRunJob {
  return 'data' in job ? job.data : job;
}

export function assertResult(
  moduleSlug: string,
  providerResult: ProviderResult,
): unknown {
  if (providerResult.kind !== 'result') {
    throw new Error('Resultado aceito não pode ser concluído no processador de execução.');
  }

  const contract = getModule(moduleSlug);
  if (!contract) {
    throw new InvalidProviderResultError();
  }

  const parsed = contract.output.safeParse(providerResult.data);
  if (!parsed.success) {
    throw new InvalidProviderResultError();
  }

  return parsed.data;
}

export class QueryRunProcessor {
  constructor(private readonly dependencies: WorkerDependencies) {}

  async process(job: QueryRunJob | Job<QueryRunJob>): Promise<void> {
    const { queryId } = jobData(job);
    const started = await markRunning(this.dependencies, queryId);

    if (!started) {
      return;
    }

    const query = await this.dependencies.prisma.query.findUnique({
      where: { id: queryId },
      select: {
        status: true,
        moduleSlug: true,
        input: true,
        providerRequestId: true,
        attempts: true,
      },
    });

    if (!query || query.status !== QueryStatus.running) {
      return;
    }

    // A retried run job may arrive after the provider accepted the request.
    // Continue polling the existing request instead of charging or executing
    // it a second time.
    if (query.providerRequestId) {
      await this.dependencies.pollQueue.add(
        'query:poll',
        {
          queryId,
          requestId: query.providerRequestId,
          attempt: query.attempts,
        },
        {
          jobId: `${queryId}:poll:${query.attempts}`,
          delay: this.dependencies.initialPollDelayMs,
        },
      );
      return;
    }

    try {
      const input = asInputRecord(query.input);
      const providerResult = await this.dependencies.provider.execute({
        module: query.moduleSlug,
        input,
      });

      if (providerResult.kind === 'accepted') {
        const nextPollAt = new Date(
          this.dependencies.now().getTime() + this.dependencies.initialPollDelayMs,
        );

        await this.dependencies.prisma.$transaction(async (tx) => {
          const current = await tx.query.findUnique({
            where: { id: queryId },
            select: { status: true },
          });

          if (!current || current.status !== QueryStatus.running) {
            return;
          }

          await tx.query.update({
            where: { id: queryId },
            data: {
              providerRequestId: providerResult.requestId,
              attempts: 0,
              nextPollAt,
            },
          });
        });

        await this.dependencies.pollQueue.add(
          'query:poll',
          { queryId, requestId: providerResult.requestId, attempt: 0 },
          {
            jobId: `${queryId}:poll:0`,
            delay: this.dependencies.initialPollDelayMs,
          },
        );
        return;
      }

      const data = assertResult(query.moduleSlug, providerResult);
      await finishWithResult(this.dependencies, queryId, data);
    } catch (error) {
      // Keep the stable error code available to logs/tests while never putting
      // provider details in the API-facing error message.
      if (errorCodeFor(error) === 'QUERY_FAILED') {
        await finishWithFailure(this.dependencies, queryId, error);
        return;
      }

      await finishWithFailure(this.dependencies, queryId, error);
    }
  }
}

export { InvalidProviderResultError };

/** Convenience factory for callers that use BullMQ's processor signature. */
export function createQueryRunProcessor(
  dependencies: WorkerDependencies,
): (job: Job<QueryRunJob>) => Promise<void> {
  const processor = new QueryRunProcessor(dependencies);
  return (job) => processor.process(job);
}
