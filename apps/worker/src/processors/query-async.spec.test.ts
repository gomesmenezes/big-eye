import { describe, expect, it } from 'vitest';

import { QueryStatus } from '@big-eye/core/db/prisma-client';
import type { RetryInputCache } from '@big-eye/core/queries/input-retry-cache';
import { InMemoryQueryEventsBus } from '@big-eye/core/query-events';
import type { ResultCache } from '@big-eye/core/result-cache';

import type { WorkerDependencies } from './context.js';
import { QueryPollProcessor } from './query-poll.processor.js';
import { QueryRunProcessor } from './query-run.processor.js';

type FakeQuery = {
  id: string;
  userId: string;
  status: QueryStatus;
  moduleSlug: string;
  input: Record<string, unknown> | null;
  providerRequestId: string | null;
  attempts: number;
  creditsCharged: number;
  startedAt: Date | null;
  nextPollAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  finishedAt: Date | null;
};

function selected<T extends object>(query: FakeQuery, select: Record<string, boolean>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    result[key] = query[key as keyof FakeQuery];
  }
  return result as T;
}

function createHarness(provider: {
  execute(request: { module: string; input: Record<string, unknown> }): Promise<
    | { kind: 'accepted'; requestId: string }
    | { kind: 'result'; data: unknown }
  >;
  poll(requestId: string): Promise<
    | { kind: 'accepted'; requestId: string }
    | { kind: 'result'; data: unknown }
  >;
}): {
  query: FakeQuery;
  cache: ResultCache & { values: Map<string, { data: unknown }> };
  retryInputCache: RetryInputCache & { values: Map<string, Record<string, unknown>> };
  jobs: Array<{ name: string; data: { queryId: string; requestId?: string; attempt: number } }>;
  dependencies: WorkerDependencies;
} {
  const query: FakeQuery = {
    id: '00000000-0000-4000-8000-000000000007',
    userId: '00000000-0000-4000-8000-000000000008',
    status: QueryStatus.pending,
    moduleSlug: 'dossie-360',
    input: { cpf: '12345678900' },
    providerRequestId: null,
    attempts: 0,
    creditsCharged: 1,
    startedAt: null,
    nextPollAt: null,
    errorCode: null,
    errorMessage: null,
    finishedAt: null,
  };
  const jobs: Array<{
    name: string;
    data: { queryId: string; requestId?: string; attempt: number };
  }> = [];
  const events = new InMemoryQueryEventsBus();
  const values = new Map<string, { data: unknown }>();
  const cache = {
    values,
    async get(queryId: string) {
      return values.get(queryId) ?? null;
    },
    async set(queryId: string, payload: { data: unknown }) {
      values.set(queryId, payload);
    },
    async del(queryId: string) {
      values.delete(queryId);
    },
  } satisfies ResultCache & { values: Map<string, { data: unknown }> };
  const retryInputValues = new Map<string, Record<string, unknown>>([
    [query.id, { cpf: '12345678900' }],
  ]);
  const retryInputCache: RetryInputCache & {
    values: Map<string, Record<string, unknown>>;
  } = {
    values: retryInputValues,
    async get(queryId: string): Promise<Record<string, unknown> | null> {
      return retryInputValues.get(queryId) ?? null;
    },
    async set(queryId: string, input: Record<string, unknown>) {
      retryInputValues.set(queryId, input);
    },
    async del(queryId: string) {
      retryInputValues.delete(queryId);
    },
  };
  const queryApi = {
    async findUnique(args: { select: Record<string, boolean> }) {
      return selected(query, args.select);
    },
    async update(args: { data: Partial<FakeQuery> }) {
      Object.assign(query, args.data);
      return query;
    },
  };
  const tx = {
    query: queryApi,
    queryEvent: { create: async () => undefined },
    async $queryRaw() {
      return [{ id: query.id }];
    },
  };
  const prisma = {
    query: queryApi,
    async $transaction<T>(callback: (transaction: typeof tx) => Promise<T>): Promise<T> {
      return callback(tx);
    },
  };
  const refunded: string[] = [];
  const dependencies = {
    prisma,
    credits: {
      async refundQuery(_tx: unknown, input: { queryId: string }) {
        refunded.push(input.queryId);
      },
    },
    provider,
    resultCache: cache,
    retryInputCache,
    eventsBus: events,
    pollQueue: {
      async add(
        name: string,
        data: { queryId: string; requestId?: string; attempt: number },
      ) {
        jobs.push({ name, data });
      },
    },
    now: () => new Date('2026-09-27T12:00:00.000Z'),
    maxPollAttempts: 2,
    initialPollDelayMs: 1,
    maxPollDelayMs: 10,
  } as unknown as WorkerDependencies & { refunded: string[] };
  dependencies.refunded = refunded;

  return { query, cache, retryInputCache, jobs, dependencies };
}

describe('async query processors', () => {
  it('transitions accepted queries through polling and stores the result in Redis cache', async () => {
    const harness = createHarness({
      async execute() {
        return { kind: 'accepted', requestId: 'provider-request-7' };
      },
      async poll() {
        return {
          kind: 'result',
          data: { resumo: 'Consulta pronta', fontes: ['fake-provider'] },
        };
      },
    });
    const received: string[] = [];
    const unsubscribe = await harness.dependencies.eventsBus.subscribe(
      harness.query.id,
      (event) => {
        received.push(event.status);
      },
    );

    await new QueryRunProcessor(harness.dependencies).process({ queryId: harness.query.id });
    expect(harness.query.status).toBe(QueryStatus.running);
    expect(harness.jobs[0]?.data).toMatchObject({
      queryId: harness.query.id,
      requestId: 'provider-request-7',
      attempt: 0,
    });

    await new QueryPollProcessor(harness.dependencies).process(harness.jobs[0]!.data);

    expect(harness.query.status).toBe(QueryStatus.succeeded);
    await expect(harness.cache.get(harness.query.id)).resolves.toEqual({
      data: { resumo: 'Consulta pronta', fontes: ['fake-provider'] },
    });
    expect(harness.retryInputCache.values).toEqual(new Map());
    expect(received).toEqual(['running', 'succeeded']);
    await unsubscribe();
  });

  it('retries transient polls and refunds after the configured attempt limit', async () => {
    const harness = createHarness({
      async execute() {
        return { kind: 'accepted', requestId: 'provider-request-8' };
      },
      async poll() {
        throw Object.assign(new Error('upstream unavailable'), {
          code: 'PROVIDER_UNAVAILABLE',
        });
      },
    });
    const run = new QueryRunProcessor(harness.dependencies);
    const poll = new QueryPollProcessor(harness.dependencies);

    await run.process({ queryId: harness.query.id });
    await poll.process(harness.jobs.shift()!.data);
    expect(harness.query.status).toBe(QueryStatus.running);
    await poll.process(harness.jobs.shift()!.data);

    expect(harness.query.status).toBe(QueryStatus.refunded);
    expect(harness.retryInputCache.values.get(harness.query.id)).toEqual({
      cpf: '12345678900',
    });
    expect((harness.dependencies as WorkerDependencies & { refunded: string[] }).refunded).toEqual([
      harness.query.id,
    ]);
  });
});
