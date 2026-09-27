import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CreditsService } from '../credits/credits.service.js';
import { PrismaClient } from '../db/prisma-client.js';
import { FakeProvider } from '../provider/fake.provider.js';
import {
  ProviderError,
  type ProviderClient,
  type ProviderResult,
} from '../provider/provider.client.js';
import type { ResultCache } from '../result-cache.js';

import type { RetryInputCache } from './input-retry-cache.js';
import { QueriesService } from './queries.service.js';

const localDatabaseUrl =
  'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public';
const databaseUrl =
  process.env.BIGEYE_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  localDatabaseUrl;
const allowNonLocalDatabase =
  process.env.BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE === 'true';
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, '').split('/')[0];
const isLocalTestDatabase =
  ['localhost', '127.0.0.1', '::1'].includes(parsedDatabaseUrl.hostname) &&
  databaseName === 'bigeye';

if (!isLocalTestDatabase && !allowNonLocalDatabase) {
  throw new Error(
    'O teste de consultas só pode usar o banco local "bigeye". Para outro banco de teste, defina BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE=true explicitamente.',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function createWallet(balance: number): Promise<string> {
  const userId = randomUUID();

  await prisma.profile.create({
    data: {
      id: userId,
      email: `queries-${userId}@example.test`,
      name: 'Teste de consultas',
      wallet: { create: { balance } },
    },
  });

  return userId;
}

async function removeUserData(userId: string): Promise<void> {
  const queries = await prisma.query.findMany({
    where: { userId },
    select: { id: true },
  });
  const queryIds = queries.map(({ id }) => id);

  await prisma.queryEvent.deleteMany({ where: { queryId: { in: queryIds } } });
  await prisma.creditTransaction.deleteMany({ where: { userId } });
  await prisma.query.deleteMany({ where: { userId } });
  await prisma.wallet.deleteMany({ where: { userId } });
  await prisma.profile.deleteMany({ where: { id: userId } });
}

function providerReturning(result: ProviderResult): ProviderClient {
  return {
    execute: async () => result,
    poll: async () => result,
  };
}

function createRetryInputCache(): {
  cache: RetryInputCache;
  values: Map<string, Record<string, unknown>>;
} {
  const values = new Map<string, Record<string, unknown>>();
  return {
    values,
    cache: {
      async get(queryId) {
        return values.get(queryId) ?? null;
      },
      async set(queryId, input) {
        values.set(queryId, input);
      },
      async del(queryId) {
        values.delete(queryId);
      },
    },
  };
}

describe('QueriesService síncrono', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('conclui a consulta, apaga a entrada e mantém o débito', async () => {
    const userId = await createWallet(2);
    const retryInput = createRetryInputCache();
    const service = new QueriesService(
      prisma,
      new CreditsService(prisma),
      new FakeProvider(),
      undefined,
      undefined,
      retryInput.cache,
    );

    try {
      const result = await service.create(userId, 'cpf-basico', { cpf: '12345678901' });
      const query = await prisma.query.findUniqueOrThrow({ where: { id: result.id } });
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

      expect(result.status).toBe('succeeded');
      expect(result.data).toMatchObject({ cpf: '12345678901' });
      expect(query.input).toBeNull();
      expect(query.inputMasked).toBe('***.***.***-01');
      expect(query.inputHash).toMatch(/^[a-f0-9]{64}$/);
      expect(wallet.balance).toBe(1);
      expect(retryInput.values).toEqual(new Map());
    } finally {
      await removeUserData(userId);
    }
  });

  it('marca falha e reembolsa quando o provedor lança erro', async () => {
    const userId = await createWallet(1);
    const provider: ProviderClient = {
      execute: async () => {
        throw new ProviderError('PROVIDER_UNAVAILABLE');
      },
      poll: async () => {
        throw new ProviderError('PROVIDER_UNAVAILABLE');
      },
    };
    const retryInput = createRetryInputCache();
    const service = new QueriesService(
      prisma,
      new CreditsService(prisma),
      provider,
      undefined,
      undefined,
      retryInput.cache,
    );

    try {
      const result = await service.create(userId, 'cpf-basico', { cpf: '12345678901' });
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

      expect(result.status).toBe('refunded');
      expect(result.errorCode).toBe('PROVIDER_UNAVAILABLE');
      expect(wallet.balance).toBe(1);
      expect(retryInput.values.get(result.id)).toEqual({ cpf: '12345678901' });
      await expect(
        prisma.creditTransaction.count({
          where: { userId, type: 'refund' },
        }),
      ).resolves.toBe(1);
    } finally {
      await removeUserData(userId);
    }
  });

  it('marca falha e reembolsa quando o payload sai do schema', async () => {
    const userId = await createWallet(1);
    const service = new QueriesService(
      prisma,
      new CreditsService(prisma),
      providerReturning({ kind: 'result', data: { unexpected: true } }),
    );

    try {
      const result = await service.create(userId, 'cpf-basico', { cpf: '12345678901' });

      expect(result.status).toBe('refunded');
      expect(result.errorCode).toBe('QUERY_FAILED');
      await expect(
        prisma.creditTransaction.count({ where: { userId, type: 'refund' } }),
      ).resolves.toBe(1);
    } finally {
      await removeUserData(userId);
    }
  });

  it('não cria consulta nem debita quando o saldo é insuficiente', async () => {
    const userId = await createWallet(0);
    const service = new QueriesService(prisma, new CreditsService(prisma), new FakeProvider());

    try {
      await expect(
        service.create(userId, 'cpf-basico', { cpf: '12345678901' }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
      await expect(prisma.query.count({ where: { userId } })).resolves.toBe(0);
      await expect(prisma.creditTransaction.count({ where: { userId } })).resolves.toBe(0);
    } finally {
      await removeUserData(userId);
    }
  });

  it('reutiliza a consulta da Idempotency-Key sem novo débito mesmo com outro corpo', async () => {
    const userId = await createWallet(2);
    const service = new QueriesService(prisma, new CreditsService(prisma), new FakeProvider());

    try {
      const first = await service.create(
        userId,
        'cpf-basico',
        { cpf: '12345678901' },
        'request-replay-1',
      );
      const retry = await service.create(
        userId,
        'cpf-basico',
        { cpf: '98765432109' },
        'request-replay-1',
      );
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });

      expect(retry.id).toBe(first.id);
      expect(wallet.balance).toBe(1);
      await expect(prisma.query.count({ where: { userId } })).resolves.toBe(1);
      await expect(
        prisma.creditTransaction.count({ where: { userId, type: 'consume' } }),
      ).resolves.toBe(1);
    } finally {
      await removeUserData(userId);
    }
  });

  it('enfileira uma consulta assíncrona depois de debitar e devolve 202 metadata', async () => {
    const userId = await createWallet(1);
    const enqueued: string[] = [];
    const service = new QueriesService(
      prisma,
      new CreditsService(prisma),
      new FakeProvider(),
      undefined,
      async (queryId) => {
        enqueued.push(queryId);
      },
    );

    try {
      const result = await service.create(userId, 'dossie-360', { cpf: '12345678900' });

      expect(result).toMatchObject({
        moduleSlug: 'dossie-360',
        mode: 'async',
        status: 'pending',
      });
      expect(enqueued).toEqual([result.id]);
      await expect(prisma.wallet.findUniqueOrThrow({ where: { userId } })).resolves.toMatchObject({
        balance: 0,
      });
    } finally {
      await removeUserData(userId);
    }
  });

  it('mantém o status succeeded e sinaliza resultExpired quando o cache expira', async () => {
    const userId = await createWallet(1);
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
    const service = new QueriesService(
      prisma,
      new CreditsService(prisma),
      new FakeProvider(),
      cache,
    );

    try {
      const created = await service.create(userId, 'cpf-basico', { cpf: '12345678901' });
      await expect(service.get(userId, created.id)).resolves.toMatchObject({
        status: 'succeeded',
        data: { cpf: '12345678901' },
      });

      values.clear();
      await expect(service.get(userId, created.id)).resolves.toMatchObject({
        status: 'succeeded',
        resultExpired: true,
      });
    } finally {
      await removeUserData(userId);
    }
  });
});
