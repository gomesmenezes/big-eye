import { describe, expect, it } from 'vitest';

import type { PrismaClient } from '@big-eye/core/db/prisma-client';
import { QueryStatus } from '@big-eye/core/db/prisma-client';
import { InMemoryQueryEventsBus } from '@big-eye/core/query-events';
import type { ResultCache } from '@big-eye/core/result-cache';

import type { ApiUser } from '../auth/auth.types.js';

import { QueriesSseController } from './queries-sse.controller.js';

const user: ApiUser = {
  id: '00000000-0000-4000-8000-000000000008',
  email: 'user@example.test',
  role: 'user',
  status: 'active',
};

function createHarness(initialStatus: QueryStatus) {
  const query = {
    id: '00000000-0000-4000-8000-000000000007',
    userId: user.id,
    status: initialStatus,
    errorCode: null as string | null,
    errorMessage: null as string | null,
  };
  const values = new Map<string, { data: unknown }>();
  const cache: ResultCache = {
    async get(queryId) {
      return values.get(queryId) ?? null;
    },
    async set(queryId, payload) {
      values.set(queryId, payload);
    },
    async del(queryId) {
      values.delete(queryId);
    },
  };
  const prisma = {
    query: {
      async findFirst(args: { select: Record<string, boolean> }) {
        if ('id' in args.select) {
          return { id: query.id };
        }

        return {
          status: query.status,
          errorCode: query.errorCode,
          errorMessage: query.errorMessage,
        };
      },
    },
  } as unknown as PrismaClient;
  const bus = new InMemoryQueryEventsBus();

  return {
    query,
    values,
    bus,
    controller: new QueriesSseController(prisma, bus, cache),
  };
}

async function collect(
  observable: Awaited<ReturnType<QueriesSseController['stream']>>,
): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = [];

  await new Promise<void>((resolve, reject) => {
    observable.subscribe({
      next: (event) => events.push(event.data as Record<string, unknown>),
      error: reject,
      complete: resolve,
    });
  });

  return events;
}

describe('query SSE', () => {
  it('emits the terminal result after a client disconnects and reconnects', async () => {
    const harness = createHarness(QueryStatus.running);
    const first = await harness.controller.stream(harness.query.id, user);
    const firstEvents: Record<string, unknown>[] = [];
    const firstSubscription = first.subscribe({
      next: (event) => firstEvents.push(event.data as Record<string, unknown>),
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    firstSubscription.unsubscribe();

    harness.query.status = QueryStatus.succeeded;
    harness.values.set(harness.query.id, { data: { resumo: 'pronto' } });
    await harness.bus.publish(harness.query.id, { status: QueryStatus.succeeded });

    const reconnected = await harness.controller.stream(harness.query.id, user);
    await expect(collect(reconnected)).resolves.toEqual([
      { status: QueryStatus.succeeded, data: { resumo: 'pronto' } },
    ]);
    expect(firstEvents).toEqual([{ status: QueryStatus.running }]);
  });

  it('marks a succeeded query as expired when its Redis result is gone', async () => {
    const harness = createHarness(QueryStatus.succeeded);
    const stream = await harness.controller.stream(harness.query.id, user);

    await expect(collect(stream)).resolves.toEqual([
      { status: QueryStatus.succeeded, resultExpired: true },
    ]);
  });
});
