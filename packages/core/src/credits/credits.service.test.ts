import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient, type Prisma } from '../db/prisma-client.js';

import { CreditTxRepository } from './credit-tx.repository.js';
import {
  CreditsService,
  DuplicateTransactionError,
  InsufficientCreditsError,
} from './credits.service.js';

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
    'O teste de créditos só pode usar o banco local "bigeye". Para outro banco de teste, defina BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE=true explicitamente.',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const credits = new CreditsService(prisma);
const creditTxRepository = new CreditTxRepository();

async function createWallet(balance: number): Promise<string> {
  const userId = randomUUID();

  await prisma.profile.create({
    data: {
      id: userId,
      email: `credits-${userId}@example.test`,
      name: 'Teste de créditos',
      wallet: { create: { balance } },
    },
  });

  return userId;
}

async function removeUserData(userIds: string[]): Promise<void> {
  await prisma.creditTransaction.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.adminAuditLog.deleteMany({
    where: {
      OR: [{ adminUserId: { in: userIds } }, { targetUserId: { in: userIds } }],
    },
  });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.profile.deleteMany({ where: { id: { in: userIds } } });
}

describe('CreditsService', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('debita saldo suficiente e registra o saldo resultante no ledger', async () => {
    const userId = await createWallet(3);
    const queryId = randomUUID();

    try {
      await prisma.$transaction((tx) =>
        credits.debitForQuery(tx, {
          userId,
          queryId,
          amount: 2,
          description: 'Consulta de teste',
        }),
      );

      const [wallet, transaction] = await Promise.all([
        prisma.wallet.findUniqueOrThrow({ where: { userId } }),
        prisma.creditTransaction.findFirstOrThrow({
          where: { userId, idempotencyKey: queryId },
        }),
      ]);

      expect(wallet.balance).toBe(1);
      expect(transaction).toMatchObject({
        type: 'consume',
        amount: -2,
        balanceAfter: 1,
        refType: 'query',
        refId: queryId,
      });
      await expect(credits.getBalance(userId)).resolves.toBe(1);
    } finally {
      await removeUserData([userId]);
    }
  });

  it('rejeita débito insuficiente sem alterar a carteira ou criar ledger', async () => {
    const userId = await createWallet(1);

    try {
      await expect(
        prisma.$transaction((tx) =>
          credits.debitForQuery(tx, {
            userId,
            queryId: randomUUID(),
            amount: 2,
            description: 'Consulta sem saldo',
          }),
        ),
      ).rejects.toBeInstanceOf(InsufficientCreditsError);

      await expect(credits.getBalance(userId)).resolves.toBe(1);
      await expect(
        prisma.creditTransaction.count({ where: { userId } }),
      ).resolves.toBe(0);
    } finally {
      await removeUserData([userId]);
    }
  });

  it('rejeita o segundo débito da mesma consulta sem debitar novamente', async () => {
    const userId = await createWallet(2);
    const queryId = randomUUID();
    const debit = (tx: Prisma.TransactionClient) =>
      credits.debitForQuery(tx, {
        userId,
        queryId,
        amount: 1,
        description: 'Consulta repetida',
      });

    try {
      await prisma.$transaction(debit);

      await expect(prisma.$transaction(debit)).rejects.toBeInstanceOf(
        DuplicateTransactionError,
      );
      await expect(credits.getBalance(userId)).resolves.toBe(1);
      await expect(
        prisma.creditTransaction.count({
          where: { userId, type: 'consume', refId: queryId },
        }),
      ).resolves.toBe(1);
    } finally {
      await removeUserData([userId]);
    }
  });

  it('converte a violação de unicidade do ledger em DuplicateTransactionError', async () => {
    const firstUserId = await createWallet(2);
    const secondUserId = await createWallet(2);
    const queryId = randomUUID();

    try {
      await prisma.$transaction((tx) =>
        credits.debitForQuery(tx, {
          userId: firstUserId,
          queryId,
          amount: 1,
          description: 'Consulta duplicada',
        }),
      );
      const secondWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId: secondUserId },
      });

      await expect(
        prisma.$transaction((tx) =>
          creditTxRepository.create(tx, {
            walletId: secondWallet.id,
            userId: secondUserId,
            type: 'consume',
            amount: -1,
            balanceAfter: 1,
            refType: 'query',
            refId: queryId,
            description: 'Tentativa duplicada',
            idempotencyKey: queryId,
          }),
        ),
      ).rejects.toBeInstanceOf(DuplicateTransactionError);
      await expect(credits.getBalance(secondUserId)).resolves.toBe(2);
    } finally {
      await removeUserData([firstUserId, secondUserId]);
    }
  });

  it('aplica o refund de uma consulta uma única vez', async () => {
    const userId = await createWallet(3);
    const queryId = randomUUID();

    try {
      await prisma.$transaction((tx) =>
        credits.debitForQuery(tx, {
          userId,
          queryId,
          amount: 2,
          description: 'Consulta que falhou',
        }),
      );

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await prisma.$transaction((tx) =>
          credits.refundQuery(tx, {
            userId,
            queryId,
            amount: 2,
            reason: 'Falha do provedor',
          }),
        );
      }

      const transactions = await prisma.creditTransaction.findMany({
        where: { userId, refType: 'query', refId: queryId },
        orderBy: { createdAt: 'asc' },
      });

      expect(await credits.getBalance(userId)).toBe(3);
      expect(transactions.filter(({ type }) => type === 'refund')).toHaveLength(
        1,
      );
      expect(transactions.find(({ type }) => type === 'refund')).toMatchObject({
        amount: 2,
        balanceAfter: 3,
      });
    } finally {
      await removeUserData([userId]);
    }
  });

  it('não cria crédito de refund quando não existe débito da consulta', async () => {
    const userId = await createWallet(0);

    try {
      await expect(
        prisma.$transaction((tx) =>
          credits.refundQuery(tx, {
            userId,
            queryId: randomUUID(),
            amount: 2,
            reason: 'Consulta não cobrada',
          }),
        ),
      ).rejects.toThrow('sem débito correspondente');

      await expect(credits.getBalance(userId)).resolves.toBe(0);
      await expect(
        prisma.creditTransaction.count({ where: { userId } }),
      ).resolves.toBe(0);
    } finally {
      await removeUserData([userId]);
    }
  });

  it('credita uma compra repetida do mesmo pagamento uma única vez', async () => {
    const userId = await createWallet(1);
    const paymentId = randomUUID();

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await prisma.$transaction((tx) =>
          credits.creditPurchase(tx, { userId, paymentId, amount: 5 }),
        );
      }

      await expect(credits.getBalance(userId)).resolves.toBe(6);
      await expect(
        prisma.creditTransaction.count({
          where: {
            userId,
            type: 'purchase',
            refType: 'payment',
            refId: paymentId,
          },
        }),
      ).resolves.toBe(1);
    } finally {
      await removeUserData([userId]);
    }
  });

  it('registra ajuste administrativo no ledger e no audit log', async () => {
    const targetUserId = await createWallet(5);
    const adminId = await createWallet(0);

    try {
      await prisma.$transaction((tx) =>
        credits.adjust(tx, {
          userId: targetUserId,
          adminId,
          amount: -2,
          reason: 'Correção solicitada',
        }),
      );

      const [transaction, audit] = await Promise.all([
        prisma.creditTransaction.findFirstOrThrow({
          where: { userId: targetUserId, type: 'admin_adjust' },
        }),
        prisma.adminAuditLog.findFirstOrThrow({
          where: { adminUserId: adminId, targetUserId },
        }),
      ]);

      expect(await credits.getBalance(targetUserId)).toBe(3);
      expect(transaction).toMatchObject({
        amount: -2,
        balanceAfter: 3,
        refType: 'admin',
        refId: audit.id,
      });
      expect(audit).toMatchObject({
        action: 'wallet.adjust',
        payload: { amount: -2, reason: 'Correção solicitada' },
      });
    } finally {
      await removeUserData([targetUserId, adminId]);
    }
  });

  it('lista transações por cursor sem misturar usuários', async () => {
    const userId = await createWallet(0);
    const otherUserId = await createWallet(0);

    try {
      await prisma.$transaction((tx) =>
        credits.creditPurchase(tx, {
          userId,
          paymentId: randomUUID(),
          amount: 1,
        }),
      );
      await prisma.$transaction((tx) =>
        credits.creditPurchase(tx, {
          userId,
          paymentId: randomUUID(),
          amount: 2,
        }),
      );
      await prisma.$transaction((tx) =>
        credits.creditPurchase(tx, {
          userId: otherUserId,
          paymentId: randomUUID(),
          amount: 10,
        }),
      );

      const firstPage = await credits.listTransactions(userId, { limit: 1 });
      const secondPage = await credits.listTransactions(userId, {
        limit: 1,
        cursor: firstPage[0]?.id,
      });

      expect(firstPage).toHaveLength(1);
      expect(secondPage).toHaveLength(1);
      expect(secondPage[0]?.userId).toBe(userId);
      expect(secondPage[0]?.id).not.toBe(firstPage[0]?.id);
      await expect(
        credits.listTransactions(userId, {
          limit: 10,
          cursor: randomUUID(),
        }),
      ).resolves.toEqual([]);
    } finally {
      await removeUserData([userId, otherUserId]);
    }
  });

  it('permite exatamente cinco de vinte débitos concorrentes com saldo cinco', async () => {
    const userId = await createWallet(5);

    try {
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          prisma.$transaction(
            (tx) =>
              credits.debitForQuery(tx, {
                userId,
                queryId: randomUUID(),
                amount: 1,
                description: `Consulta concorrente ${index + 1}`,
              }),
            { maxWait: 15_000, timeout: 15_000 },
          ),
        ),
      );
      const successes = results.filter(({ status }) => status === 'fulfilled');
      const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      expect(successes).toHaveLength(5);
      expect(failures).toHaveLength(15);
      expect(
        failures.every(
          ({ reason }) => reason instanceof InsufficientCreditsError,
        ),
      ).toBe(true);
      await expect(credits.getBalance(userId)).resolves.toBe(0);
      await expect(
        prisma.creditTransaction.count({
          where: { userId, type: 'consume' },
        }),
      ).resolves.toBe(5);
    } finally {
      await removeUserData([userId]);
    }
  }, 30_000);
});
