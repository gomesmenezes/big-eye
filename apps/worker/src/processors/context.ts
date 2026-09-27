import type { JobsOptions } from 'bullmq';

import { CreditsService } from '@big-eye/core/credits/credits.service';
import { prisma } from '@big-eye/core/db/prisma';
import type { PrismaClient } from '@big-eye/core/db/prisma-client';
import type { ProviderClient } from '@big-eye/core/provider/provider.client';
import { getProviderClient } from '@big-eye/core/provider/registry';
import { retryInputCache, type RetryInputCache } from '@big-eye/core/queries/input-retry-cache';
import { queryEventsBus, type QueryEventsBus } from '@big-eye/core/query-events';
import { queryPollQueue } from '@big-eye/core/queues/queues';
import type { QueryPollJob } from '@big-eye/core/queues/queues';
import { resultCache, type ResultCache } from '@big-eye/core/result-cache';

export type PollQueue = {
  add(
    name: string,
    data: QueryPollJob,
    options?: JobsOptions,
  ): Promise<unknown>;
};

export type WorkerDependencies = {
  prisma: PrismaClient;
  credits: CreditsService;
  provider: ProviderClient;
  resultCache: ResultCache;
  retryInputCache: RetryInputCache;
  eventsBus: QueryEventsBus;
  pollQueue: PollQueue;
  now: () => Date;
  maxPollAttempts: number;
  initialPollDelayMs: number;
  maxPollDelayMs: number;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createWorkerDependencies(): WorkerDependencies {
  return {
    prisma,
    credits: new CreditsService(prisma),
    provider: getProviderClient(),
    resultCache,
    retryInputCache,
    eventsBus: queryEventsBus,
    pollQueue: queryPollQueue,
    now: () => new Date(),
    maxPollAttempts: positiveInteger(process.env.QUERY_MAX_POLL_ATTEMPTS, 5),
    initialPollDelayMs: positiveInteger(process.env.QUERY_POLL_INITIAL_DELAY_MS, 1_000),
    maxPollDelayMs: positiveInteger(process.env.QUERY_POLL_MAX_DELAY_MS, 30_000),
  };
}
