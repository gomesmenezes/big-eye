import type { Prisma, PrismaClient } from '../db/prisma-client.js';
import { CreditTxType, RefType } from '../db/prisma-client.js';
import { prisma } from '../db/prisma.js';

import {
  CreditTxRepository,
  DuplicateTransactionError,
} from './credit-tx.repository.js';

const MAX_DATABASE_INT = 2_147_483_647;
const MIN_DATABASE_INT = -2_147_483_648;
const DEFAULT_TRANSACTION_LIMIT = 20;
const MAX_TRANSACTION_LIMIT = 100;

export { DuplicateTransactionError } from './credit-tx.repository.js';

export class InsufficientCreditsError extends Error {
  readonly code = 'INSUFFICIENT_CREDITS' as const;

  constructor(
    readonly available: number,
    readonly required: number,
  ) {
    super('Saldo insuficiente para realizar esta operação.');
    this.name = 'InsufficientCreditsError';
  }
}

export type ListTransactionsOptions = {
  limit?: number;
  cursor?: string;
};

function assertPositiveCreditAmount(amount: number): void {
  if (
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > MAX_DATABASE_INT
  ) {
    throw new RangeError('A quantidade de créditos deve ser um inteiro positivo.');
  }
}

function assertAdjustmentAmount(amount: number): void {
  if (
    !Number.isInteger(amount) ||
    amount === 0 ||
    amount < MIN_DATABASE_INT ||
    amount > MAX_DATABASE_INT
  ) {
    throw new RangeError('O ajuste deve ser um inteiro diferente de zero.');
  }
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new RangeError(`${field} não pode ficar vazio.`);
  }

  return normalized;
}

function checkedNextBalance(balance: number, amount: number): number {
  const nextBalance = balance + amount;

  if (nextBalance < 0) {
    throw new InsufficientCreditsError(balance, Math.abs(amount));
  }

  if (!Number.isInteger(nextBalance) || nextBalance > MAX_DATABASE_INT) {
    throw new RangeError('O saldo resultante excede o limite suportado.');
  }

  return nextBalance;
}

function isSameIdempotentOperation(
  transaction: {
    userId: string;
    amount: number;
  },
  userId: string,
  amount: number,
): boolean {
  return transaction.userId === userId && transaction.amount === amount;
}

export class CreditsService {
  private readonly repository = new CreditTxRepository();

  constructor(private readonly client: PrismaClient = prisma) {}

  async debitForQuery(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      queryId: string;
      amount: number;
      description: string;
    },
  ): Promise<void> {
    assertPositiveCreditAmount(input.amount);
    const description = requiredText(input.description, 'A descrição');
    const wallet = await this.repository.lockWallet(tx, input.userId);
    const existing = await this.repository.findByIdempotencyKey(
      tx,
      input.queryId,
    );

    if (existing) {
      throw new DuplicateTransactionError(
        'Já existe um débito associado a esta consulta.',
      );
    }

    if (wallet.balance < input.amount) {
      throw new InsufficientCreditsError(wallet.balance, input.amount);
    }

    const nextBalance = checkedNextBalance(wallet.balance, -input.amount);

    await this.repository.create(tx, {
      walletId: wallet.id,
      userId: input.userId,
      type: CreditTxType.consume,
      amount: -input.amount,
      balanceAfter: nextBalance,
      refType: RefType.query,
      refId: input.queryId,
      description,
      idempotencyKey: input.queryId,
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: nextBalance },
    });
  }

  async refundQuery(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      queryId: string;
      amount: number;
      reason: string;
    },
  ): Promise<void> {
    assertPositiveCreditAmount(input.amount);
    const reason = requiredText(input.reason, 'O motivo do reembolso');
    const wallet = await this.repository.lockWallet(tx, input.userId);
    const existing = await this.repository.findByReference(tx, {
      refType: RefType.query,
      refId: input.queryId,
      type: CreditTxType.refund,
    });

    if (existing) {
      if (!isSameIdempotentOperation(existing, input.userId, input.amount)) {
        throw new DuplicateTransactionError(
          'O reembolso desta consulta já foi registrado com outros dados.',
        );
      }

      return;
    }

    const debit = await this.repository.findByReference(tx, {
      refType: RefType.query,
      refId: input.queryId,
      type: CreditTxType.consume,
    });

    if (
      !debit ||
      debit.userId !== input.userId ||
      debit.amount !== -input.amount
    ) {
      throw new Error('Não é possível reembolsar uma consulta sem débito correspondente.');
    }

    const nextBalance = checkedNextBalance(wallet.balance, input.amount);

    await this.repository.create(tx, {
      walletId: wallet.id,
      userId: input.userId,
      type: CreditTxType.refund,
      amount: input.amount,
      balanceAfter: nextBalance,
      refType: RefType.query,
      refId: input.queryId,
      description: `Reembolso de consulta: ${reason}`,
      idempotencyKey: `query:${input.queryId}:refund`,
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: nextBalance },
    });
  }

  async creditPurchase(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      paymentId: string;
      amount: number;
    },
  ): Promise<void> {
    assertPositiveCreditAmount(input.amount);
    const wallet = await this.repository.lockWallet(tx, input.userId);
    const existing = await this.repository.findByReference(tx, {
      refType: RefType.payment,
      refId: input.paymentId,
      type: CreditTxType.purchase,
    });

    if (existing) {
      if (!isSameIdempotentOperation(existing, input.userId, input.amount)) {
        throw new DuplicateTransactionError(
          'A compra deste pagamento já foi registrada com outros dados.',
        );
      }

      return;
    }

    const nextBalance = checkedNextBalance(wallet.balance, input.amount);

    await this.repository.create(tx, {
      walletId: wallet.id,
      userId: input.userId,
      type: CreditTxType.purchase,
      amount: input.amount,
      balanceAfter: nextBalance,
      refType: RefType.payment,
      refId: input.paymentId,
      description: 'Compra de créditos',
      idempotencyKey: `payment:${input.paymentId}:purchase`,
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: nextBalance },
    });
  }

  async adjust(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      adminId: string;
      amount: number;
      reason: string;
    },
  ): Promise<void> {
    assertAdjustmentAmount(input.amount);
    const reason = requiredText(input.reason, 'O motivo do ajuste');
    const wallet = await this.repository.lockWallet(tx, input.userId);
    const nextBalance = checkedNextBalance(wallet.balance, input.amount);
    const audit = await tx.adminAuditLog.create({
      data: {
        adminUserId: input.adminId,
        targetUserId: input.userId,
        action: 'wallet.adjust',
        payload: { amount: input.amount, reason },
      },
      select: { id: true },
    });

    await this.repository.create(tx, {
      walletId: wallet.id,
      userId: input.userId,
      type: CreditTxType.admin_adjust,
      amount: input.amount,
      balanceAfter: nextBalance,
      refType: RefType.admin,
      refId: audit.id,
      description: `Ajuste administrativo: ${reason}`,
      idempotencyKey: `admin:${audit.id}:adjust`,
    });
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: nextBalance },
    });
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.client.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });

    if (!wallet) {
      throw new Error('A carteira do usuário não foi encontrada.');
    }

    return wallet.balance;
  }

  async listTransactions(
    userId: string,
    options: ListTransactionsOptions,
  ): Promise<Awaited<ReturnType<PrismaClient['creditTransaction']['findMany']>>> {
    const limit = options.limit ?? DEFAULT_TRANSACTION_LIMIT;

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TRANSACTION_LIMIT) {
      throw new RangeError(
        `O limite do extrato deve ser um inteiro entre 1 e ${MAX_TRANSACTION_LIMIT}.`,
      );
    }

    const where: Prisma.CreditTransactionWhereInput = { userId };
    let cursor: { id: string } | undefined;

    if (options.cursor) {
      const cursorTransaction = await this.client.creditTransaction.findFirst({
        where: { id: options.cursor, userId },
        select: { id: true },
      });

      if (!cursorTransaction) {
        return [];
      }

      cursor = { id: cursorTransaction.id };
    }

    return this.client.creditTransaction.findMany({
      where,
      ...(cursor ? { cursor, skip: 1 } : {}),
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
