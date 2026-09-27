import { Queue, type JobsOptions } from 'bullmq';

import { redis } from '../redis.js';

export const QUEUE_NAMES = {
  queryRun: 'query:run',
  queryPoll: 'query:poll',
  reconcile: 'reconcile',
} as const;

// BullMQ reserves `:` as its key separator and rejects it in a queue name.
// Keep the public/domain names from the plan while using safe physical names
// for Redis keys.
export const BULLMQ_QUEUE_NAMES = {
  queryRun: 'query-run',
  queryPoll: 'query-poll',
  reconcile: 'reconcile',
} as const;

export type QueryRunJob = {
  queryId: string;
};

export type QueryPollJob = {
  queryId: string;
  requestId?: string;
  attempt: number;
};

export type ReconcileJob = {
  olderThanMs?: number;
};

const retention: JobsOptions = {
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400, count: 1_000 },
};

const queueOptions = {
  connection: redis,
  defaultJobOptions: retention,
};

/** Jobs that start or continue a provider request. */
export const queryQueue = new Queue<QueryRunJob>(BULLMQ_QUEUE_NAMES.queryRun, queueOptions);

/** Delayed provider polls are kept on their own queue for independent workers. */
export const queryPollQueue = new Queue<QueryPollJob>(BULLMQ_QUEUE_NAMES.queryPoll, queueOptions);

/** Periodic safety-net jobs for stale queries. */
export const reconciliationQueue = new Queue<ReconcileJob>(
  QUEUE_NAMES.reconcile,
  queueOptions,
);

export async function enqueueQueryRun(
  queryId: string,
  options?: JobsOptions,
): Promise<void> {
  await queryQueue.add('query:run', { queryId }, { jobId: queryId, ...options });
}

export async function enqueueQueryPoll(
  job: QueryPollJob,
  delayMs: number,
): Promise<void> {
  await queryPollQueue.add('query:poll', job, {
    jobId: `${job.queryId}:poll:${job.attempt}`,
    delay: delayMs,
  });
}

export async function scheduleReconciliation(
  olderThanMs?: number,
): Promise<void> {
  await reconciliationQueue.add(
    'reconcile',
    { olderThanMs },
    {
      jobId: 'reconcile:singleton',
      repeat: { every: 60_000 },
    },
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    queryQueue.close(),
    queryPollQueue.close(),
    reconciliationQueue.close(),
  ]);

  if (redis.status !== 'end') {
    await redis.quit();
  }
}
