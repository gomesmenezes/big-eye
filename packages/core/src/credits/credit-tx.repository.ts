import type { Prisma } from '../db/prisma-client.js';

type LockedWallet = {
  id: string;
  balance: number;
};

export class DuplicateTransactionError extends Error {
  readonly code = 'DUPLICATE_TRANSACTION' as const;

  constructor(
    message = 'A transação de créditos já foi registrada.',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DuplicateTransactionError';
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export class CreditTxRepository {
  async lockWallet(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedWallet> {
    const wallets = await tx.$queryRaw<LockedWallet[]>`
      SELECT id, balance
      FROM wallets
      WHERE user_id = ${userId}::uuid
      FOR UPDATE
    `;
    const wallet = wallets[0];

    if (!wallet) {
      throw new Error('A carteira do usuário não foi encontrada.');
    }

    return wallet;
  }

  findByIdempotencyKey(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
  ) {
    return tx.creditTransaction.findUnique({
      where: { idempotencyKey },
    });
  }

  findByReference(
    tx: Prisma.TransactionClient,
    reference: {
      refType: NonNullable<Prisma.CreditTransactionWhereInput['refType']>;
      refId: string;
      type: Prisma.CreditTransactionWhereInput['type'];
    },
  ) {
    return tx.creditTransaction.findFirst({
      where: reference,
    });
  }

  async create(
    tx: Prisma.TransactionClient,
    data: Prisma.CreditTransactionUncheckedCreateInput,
  ): Promise<void> {
    try {
      await tx.creditTransaction.create({ data });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DuplicateTransactionError(undefined, { cause: error });
      }

      throw error;
    }
  }
}
