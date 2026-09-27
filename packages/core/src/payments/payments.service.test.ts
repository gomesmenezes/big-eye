import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CreditsService } from '../credits/credits.service.js';
import { PrismaClient } from '../db/prisma-client.js';

import { FakePaymentProvider } from './fake.provider.js';
import { InvalidPaymentSignatureError } from './payment-provider.js';
import { PaymentsService } from './payments.service.js';

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
    'O teste de pagamentos só pode usar o banco local "bigeye". Para outro banco de teste, defina BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE=true explicitamente.',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const credits = new CreditsService(prisma);
const now = new Date('2026-09-27T18:00:00.000Z');
const provider = new FakePaymentProvider('payments-service-test-secret', () => now);
const payments = new PaymentsService(prisma, provider, credits, () => now);

async function createFixture(creditsBalance = 0): Promise<{
  userId: string;
  packageId: string;
}> {
  const userId = randomUUID();
  const packageId = randomUUID();

  await prisma.profile.create({
    data: {
      id: userId,
      email: `payments-${userId}@example.test`,
      name: 'Teste de pagamentos',
      wallet: { create: { balance: creditsBalance } },
    },
  });
  await prisma.creditPackage.create({
    data: {
      id: packageId,
      slug: `payments-${packageId}`,
      credits: 5,
      priceCents: 1_990,
      currency: 'BRL',
      active: true,
    },
  });

  return { userId, packageId };
}

async function removeFixture(userId: string, packageId: string): Promise<void> {
  await prisma.webhookEvent.deleteMany({ where: { provider: 'fake' } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.creditTransaction.deleteMany({ where: { userId } });
  await prisma.wallet.deleteMany({ where: { userId } });
  await prisma.profile.deleteMany({ where: { id: userId } });
  await prisma.creditPackage.deleteMany({ where: { id: packageId } });
}

describe('PaymentsService', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a pending checkout using the active package amount and credits', async () => {
    const fixture = await createFixture();

    try {
      const payment = await payments.createCheckout(fixture.userId, {
        packageId: fixture.packageId,
        method: 'pix',
      });

      expect(payment).toMatchObject({
        method: 'pix',
        amountCents: 1_990,
        credits: 5,
        status: 'pending',
      });
      expect(payment.pixQrCode).toMatch(/^000201/);

      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({
        userId: fixture.userId,
        provider: 'fake',
        status: 'pending',
        amountCents: 1_990,
        credits: 5,
      });
    } finally {
      await removeFixture(fixture.userId, fixture.packageId);
    }
  });

  it('credits paid webhooks once and treats a repeated event as a no-op', async () => {
    const fixture = await createFixture();

    try {
      const payment = await payments.createCheckout(fixture.userId, {
        packageId: fixture.packageId,
        method: 'pix',
      });
      const providerPaymentId = (
        await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
      ).providerPaymentId;

      if (!providerPaymentId) {
        throw new Error('Fake checkout did not return a provider payment id.');
      }

      const providerEventId = randomUUID();
      const webhook = provider.createWebhook({
        providerEventId,
        providerPaymentId,
        status: 'paid',
        paidAt: now.toISOString(),
      });
      const first = await payments.handleWebhook(webhook.body, {
        'x-fake-signature': webhook.signature,
      });
      const second = await payments.handleWebhook(webhook.body, {
        'x-fake-signature': webhook.signature,
      });

      expect(first).toMatchObject({ duplicate: false, paymentId: payment.id, status: 'paid' });
      expect(second).toEqual({ duplicate: true });
      await expect(credits.getBalance(fixture.userId)).resolves.toBe(5);
      await expect(
        prisma.creditTransaction.count({
          where: { userId: fixture.userId, type: 'purchase', refType: 'payment' },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({ status: 'paid', paidAt: now });
    } finally {
      await removeFixture(fixture.userId, fixture.packageId);
    }
  });

  it('rejects an invalid signature before persisting a webhook event', async () => {
    const fixture = await createFixture();

    try {
      const payment = await payments.createCheckout(fixture.userId, {
        packageId: fixture.packageId,
        method: 'card',
      });
      const providerPaymentId = (
        await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
      ).providerPaymentId;

      if (!providerPaymentId) {
        throw new Error('Fake checkout did not return a provider payment id.');
      }

      const providerEventId = randomUUID();
      const webhook = provider.createWebhook({
        providerEventId,
        providerPaymentId,
        status: 'paid',
      });

      await expect(
        payments.handleWebhook(webhook.body, { 'x-fake-signature': 'invalid' }),
      ).rejects.toBeInstanceOf(InvalidPaymentSignatureError);
      await expect(
        prisma.webhookEvent.count({ where: { providerEventId } }),
      ).resolves.toBe(0);
      await expect(credits.getBalance(fixture.userId)).resolves.toBe(0);
    } finally {
      await removeFixture(fixture.userId, fixture.packageId);
    }
  });

  it('does not credit a paid webhook after the payment expired', async () => {
    const fixture = await createFixture();

    try {
      const payment = await payments.createCheckout(fixture.userId, {
        packageId: fixture.packageId,
        method: 'pix',
      });
      const providerPaymentId = (
        await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
      ).providerPaymentId;

      if (!providerPaymentId) {
        throw new Error('Fake checkout did not return a provider payment id.');
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'expired' },
      });
      const webhook = provider.createWebhook({
        providerEventId: randomUUID(),
        providerPaymentId,
        status: 'paid',
      });

      const result = await payments.handleWebhook(webhook.body, {
        'x-fake-signature': webhook.signature,
      });

      expect(result).toMatchObject({ duplicate: false, paymentId: payment.id, status: 'expired' });
      await expect(credits.getBalance(fixture.userId)).resolves.toBe(0);
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({ status: 'expired' });
    } finally {
      await removeFixture(fixture.userId, fixture.packageId);
    }
  });

  it('reconciles an old pending payment that the provider reports as paid', async () => {
    const fixture = await createFixture();

    try {
      const payment = await payments.createCheckout(fixture.userId, {
        packageId: fixture.packageId,
        method: 'card',
      });
      const providerPaymentId = (
        await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
      ).providerPaymentId;

      if (!providerPaymentId) {
        throw new Error('Fake checkout did not return a provider payment id.');
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: { createdAt: new Date(now.getTime() - 10 * 60 * 1000) },
      });
      provider.setStatus(providerPaymentId, 'paid');

      await expect(payments.reconcilePending()).resolves.toBe(1);
      await expect(credits.getBalance(fixture.userId)).resolves.toBe(5);
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({ status: 'paid' });
    } finally {
      await removeFixture(fixture.userId, fixture.packageId);
    }
  });
});
