import type {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from '../db/prisma-client.js';

import {
  InvalidPaymentEventError,
  InvalidPaymentSignatureError,
  type PaymentProvider,
  type ProviderPaymentStatus,
} from './payment-provider.js';

const PENDING_RECONCILIATION_AGE_MS = 5 * 60 * 1000;
const STALE_PAYMENT_AGE_MS = 24 * 60 * 60 * 1000;

export type CreditsServicePort = {
  creditPurchase(
    tx: Prisma.TransactionClient,
    input: { userId: string; paymentId: string; amount: number },
  ): Promise<void>;
};

export type PaymentPackage = {
  id: string;
  slug: string;
  credits: number;
  priceCents: number;
  currency: string;
};

export type PaymentView = {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  credits: number;
  status: PaymentStatus;
  pixQrCode?: string;
  expiresAt?: Date;
  paidAt: Date | null;
  createdAt: Date;
  checkoutUrl?: string;
};

export type WebhookHandlingResult = {
  duplicate: boolean;
  paymentId?: string;
  status?: PaymentStatus;
};

export class PaymentPackageNotFoundError extends Error {
  constructor() {
    super('Credit package not found.');
    this.name = 'PaymentPackageNotFoundError';
  }
}

export class PaymentNotFoundError extends Error {
  constructor() {
    super('Payment not found.');
    this.name = 'PaymentNotFoundError';
  }
}

type Clock = () => Date;

export class PaymentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: PaymentProvider,
    private readonly credits: CreditsServicePort,
    private readonly clock: Clock = () => new Date(),
  ) {}

  private get providerName(): string {
    return this.provider.name ?? process.env.PAYMENT_PROVIDER ?? 'fake';
  }

  async listActivePackages(): Promise<PaymentPackage[]> {
    return this.prisma.creditPackage.findMany({
      where: { active: true },
      orderBy: [{ sort: 'asc' }, { priceCents: 'asc' }],
      select: {
        id: true,
        slug: true,
        credits: true,
        priceCents: true,
        currency: true,
      },
    });
  }

  async createCheckout(
    userId: string,
    input: { packageId: string; method: PaymentMethod },
  ): Promise<PaymentView> {
    const creditPackage = await this.prisma.creditPackage.findFirst({
      where: { id: input.packageId, active: true },
      select: { id: true, credits: true, priceCents: true },
    });

    if (!creditPackage) {
      throw new PaymentPackageNotFoundError();
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: this.providerName,
        method: input.method,
        amountCents: creditPackage.priceCents,
        credits: creditPackage.credits,
      },
    });

    try {
      const checkout = await this.provider.createCheckout({
        userId,
        packageId: creditPackage.id,
        method: input.method,
        amountCents: creditPackage.priceCents,
        credits: creditPackage.credits,
      });

      if (checkout.method !== input.method) {
        throw new Error('Payment provider returned a different payment method.');
      }

      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: checkout.providerPaymentId,
          pixQrCode: checkout.pixQrCode,
          pixExpiresAt: checkout.expiresAt,
        },
      });

      return toPaymentView(updatedPayment, {
        checkoutUrl: checkout.checkoutUrl,
        expiresAt: checkout.expiresAt,
      });
    } catch (error) {
      await this.prisma.payment
        .update({
          where: { id: payment.id },
          data: { status: 'failed' },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async get(userId: string, paymentId: string): Promise<PaymentView> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new PaymentNotFoundError();
    }

    return toPaymentView(payment);
  }

  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<WebhookHandlingResult> {
    let event;

    try {
      event = await this.provider.parseWebhook(rawBody, headers);
    } catch (error) {
      if (error instanceof InvalidPaymentSignatureError || error instanceof InvalidPaymentEventError) {
        throw error;
      }

      throw new InvalidPaymentEventError();
    }

    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.webhookEvent.create({
          data: {
            provider: this.providerName,
            providerEventId: event.providerEventId,
            payload: event.raw as Prisma.InputJsonValue,
            signatureValid: true,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return { duplicate: true };
        }

        throw error;
      }

      const payment = await tx.payment.findFirst({
        where: {
          provider: this.providerName,
          providerPaymentId: event.providerPaymentId,
        },
      });

      if (!payment) {
        await tx.webhookEvent.update({
          where: { providerEventId: event.providerEventId },
          data: { processedAt: this.clock() },
        });
        return { duplicate: false };
      }

      await lockPayment(tx, payment.id);
      const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });

      if (!currentPayment) {
        await tx.webhookEvent.update({
          where: { providerEventId: event.providerEventId },
          data: { processedAt: this.clock() },
        });
        return { duplicate: false };
      }

      const status = await this.applyEventToPayment(tx, currentPayment, event.status, event.paidAt);

      await tx.webhookEvent.update({
        where: { providerEventId: event.providerEventId },
        data: { processedAt: this.clock() },
      });

      return {
        duplicate: false,
        paymentId: currentPayment.id,
        status,
      };
    });
  }

  async reconcilePending(): Promise<number> {
    const before = new Date(this.clock().getTime() - PENDING_RECONCILIATION_AGE_MS);
    const pendingPayments = await this.prisma.payment.findMany({
      where: {
        status: 'pending',
        createdAt: { lte: before },
        providerPaymentId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    let settled = 0;

    for (const payment of pendingPayments) {
      if (!payment.providerPaymentId) {
        continue;
      }

      const status = await this.provider.getStatus(payment.providerPaymentId);

      if (status === 'pending') {
        continue;
      }

      const changed = await this.settlePendingPayment(payment.id, status);
      settled += changed ? 1 : 0;
    }

    return settled;
  }

  async expireStale(): Promise<number> {
    const now = this.clock();
    const staleBefore = new Date(now.getTime() - STALE_PAYMENT_AGE_MS);
    const result = await this.prisma.payment.updateMany({
      where: {
        status: 'pending',
        OR: [
          { pixExpiresAt: { lte: now } },
          { createdAt: { lte: staleBefore } },
        ],
      },
      data: { status: 'expired' },
    });

    return result.count;
  }

  private async settlePendingPayment(
    paymentId: string,
    status: Exclude<ProviderPaymentStatus, 'pending'>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await lockPayment(tx, paymentId);
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });

      if (!payment || payment.status !== 'pending') {
        return false;
      }

      await this.applyEventToPayment(tx, payment, status);
      return true;
    });
  }

  private async applyEventToPayment(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      userId: string;
      credits: number;
      status: PaymentStatus;
    },
    status: Exclude<ProviderPaymentStatus, 'pending'>,
    paidAt?: Date,
  ): Promise<PaymentStatus> {
    if (payment.status !== 'pending') {
      return payment.status;
    }

    if (status === 'paid') {
      await this.credits.creditPurchase(tx, {
        userId: payment.userId,
        paymentId: payment.id,
        amount: payment.credits,
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'paid', paidAt: paidAt ?? this.clock() },
      });
      return 'paid';
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status },
    });
    return status;
  }
}

function toPaymentView(
  payment: {
    id: string;
    method: PaymentMethod;
    amountCents: number;
    credits: number;
    status: PaymentStatus;
    pixQrCode: string | null;
    pixExpiresAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
  },
  checkout: { checkoutUrl?: string; expiresAt?: Date } = {},
): PaymentView {
  return {
    id: payment.id,
    method: payment.method,
    amountCents: payment.amountCents,
    credits: payment.credits,
    status: payment.status,
    ...(payment.pixQrCode ? { pixQrCode: payment.pixQrCode } : {}),
    ...(payment.pixExpiresAt || checkout.expiresAt
      ? { expiresAt: payment.pixExpiresAt ?? checkout.expiresAt }
      : {}),
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    ...(checkout.checkoutUrl ? { checkoutUrl: checkout.checkoutUrl } : {}),
  };
}

async function lockPayment(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM payments
    WHERE id = ${paymentId}::uuid
    FOR UPDATE
  `;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
