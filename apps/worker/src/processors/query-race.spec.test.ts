import { randomUUID } from 'node:crypto';

import { describe, expect, it, afterAll, beforeAll } from 'vitest';

import { CreditsService } from '@big-eye/core/credits/credits.service';
import { PrismaClient, QueryStatus } from '@big-eye/core/db/prisma-client';
import type { RetryInputCache } from '@big-eye/core/queries/input-retry-cache';
import { ReconcileService } from '@big-eye/core/queries/reconcile.service';
import { InMemoryQueryEventsBus } from '@big-eye/core/query-events';
import type { ResultCache } from '@big-eye/core/result-cache';

import type { WorkerDependencies } from './context.js';
import { finishWithResult } from './query-support.js';

const localDatabaseUrl =
  'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public';
const databaseUrl =
  process.env.BIGEYE_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  localDatabaseUrl;
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, '').split('/')[0];
const isLocalTestDatabase =
  ['localhost', '127.0.0.1', '::1'].includes(parsedDatabaseUrl.hostname) &&
  databaseName === 'bigeye';

if (!isLocalTestDatabase && process.env.BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE !== 'true') {
  throw new Error(
    'O teste de concorrência só pode usar o banco local "bigeye". Para outro banco de teste, defina BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE=true explicitamente.',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

function createResultCache(): ResultCache & { values: Map<string, { data: unknown }> } {
  const values = new Map<string, { data: unknown }>();
  return {
    values,
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
}

function createRetryInputCache(): RetryInputCache {
  const values = new Map<string, Record<string, unknown>>();
  return {
    async get(queryId) {
      return values.get(queryId) ?? null;
    },
    async set(queryId, input) {
      values.set(queryId, input);
    },
    async del(queryId) {
      values.delete(queryId);
    },
  };
}

describe('query completion and reconciliation races', () => {
  const credits = new CreditsService(prisma);
  const now = new Date('2026-09-27T12:00:00.000Z');

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows only one terminal outcome when worker completion races reconciliation', async () => {
    const userId = randomUUID();
    const queryIds: string[] = [];
    const staleAt = new Date(now.getTime() - 120_000);
    const rounds = 8;

    await prisma.profile.create({
      data: {
        id: userId,
        email: `query-race-${userId}@example.test`,
        name: 'Teste de concorrência',
        wallet: { create: { balance: rounds } },
      },
    });

    try {
      for (let index = 0; index < rounds; index += 1) {
        const queryId = randomUUID();
        queryIds.push(queryId);
        await prisma.$transaction(async (tx) => {
          await tx.query.create({
            data: {
              id: queryId,
              userId,
              moduleSlug: 'dossie-360',
              mode: 'async',
              status: QueryStatus.running,
              creditsCharged: 1,
              inputHash: 'a'.repeat(64),
              inputMasked: '***.***.***-00',
              input: { cpf: '12345678900' },
              providerRequestId: `provider-race-${index}`,
              startedAt: staleAt,
              createdAt: staleAt,
            },
          });
          await credits.debitForQuery(tx, {
            userId,
            queryId,
            amount: 1,
            description: 'Consulta de teste de concorrência',
          });
          await tx.queryEvent.create({
            data: {
              queryId,
              fromStatus: 'pending',
              toStatus: QueryStatus.running,
              source: 'worker',
              message: 'Consulta iniciada para teste de concorrência.',
            },
          });
        });
      }

      const eventsBus = new InMemoryQueryEventsBus();
      const dependencies = {
        prisma,
        credits,
        provider: {
          execute: async () => ({ kind: 'result' as const, data: {} }),
          poll: async () => ({ kind: 'result' as const, data: {} }),
        },
        resultCache: createResultCache(),
        retryInputCache: createRetryInputCache(),
        eventsBus,
        pollQueue: { add: async () => undefined },
        now: () => now,
        maxPollAttempts: 2,
        initialPollDelayMs: 1,
        maxPollDelayMs: 10,
      } as unknown as WorkerDependencies;
      const reconcile = new ReconcileService(prisma, credits, eventsBus, () => now);

      await Promise.all([
        ...queryIds.map((queryId) =>
          finishWithResult(dependencies, queryId, {
            resumo: 'Consulta concluída',
            fontes: ['race-test'],
          }),
        ),
        reconcile.reconcileStuckQueries(60_000),
      ]);

      const queries = await prisma.query.findMany({
        where: { id: { in: queryIds } },
        select: { id: true, status: true },
      });
      const refunds = await prisma.creditTransaction.findMany({
        where: { userId, type: 'refund' },
        select: { refId: true },
      });
      const refundIds = new Set(refunds.map(({ refId }) => refId));

      expect(queries).toHaveLength(rounds);
      for (const query of queries) {
        expect([QueryStatus.succeeded, QueryStatus.refunded]).toContain(query.status);
        expect(refundIds.has(query.id)).toBe(query.status === QueryStatus.refunded);
      }
    } finally {
      await prisma.queryEvent.deleteMany({ where: { queryId: { in: queryIds } } });
      await prisma.creditTransaction.deleteMany({ where: { userId } });
      await prisma.query.deleteMany({ where: { id: { in: queryIds } } });
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.profile.deleteMany({ where: { id: userId } });
    }
  });
});
