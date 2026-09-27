import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from './prisma-client.js';

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
    'O teste de carteira só pode usar o banco local "bigeye". Para outro banco de teste, defina BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE=true explicitamente.',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

describe('bloqueio concorrente da carteira', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('permite somente um débito quando duas transações disputam saldo 1', async () => {
    const userId = randomUUID();
    const walletId = randomUUID();

    await prisma.profile.create({
      data: {
        id: userId,
        email: `wallet-lock-${userId}@example.test`,
        name: 'Teste de lock da carteira',
        wallet: {
          create: {
            id: walletId,
            balance: 1,
          },
        },
      },
    });

    const attemptDebit = (): Promise<boolean> =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM wallets
          WHERE user_id = ${userId}::uuid
          FOR UPDATE
        `;

        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { id: true, balance: true },
        });

        if (!wallet || wallet.balance < 1) {
          return false;
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: 1 } },
        });

        return true;
      });

    try {
      const results = await Promise.all([attemptDebit(), attemptDebit()]);
      const finalWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId },
        select: { balance: true },
      });

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(finalWallet.balance).toBe(0);
    } finally {
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.profile.deleteMany({ where: { id: userId } });
    }
  }, 15_000);
});
