import { randomUUID } from 'node:crypto';

import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CreditsService } from '@big-eye/core/credits/credits.service';
import { PrismaClient } from '@big-eye/core/db/prisma-client';
import { FakePaymentProvider, PaymentsService } from '@big-eye/core/payments';

import { PRISMA } from '../db/database.module.js';

import { PaymentsModule } from './payments.module.js';

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
    'O teste E2E de pagamentos só pode usar o banco local "bigeye". Para outro banco de teste, defina BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE=true explicitamente.',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const fakeProvider = new FakePaymentProvider('test-fake-payment-secret');
const credits = new CreditsService(prisma);

describe('payment webhook HTTP flow', () => {
  let app: NestFastifyApplication;
  let payments: PaymentsService;

  beforeAll(async () => {
    await prisma.$connect();

    const testingModule = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(PRISMA)
      .useValue(prisma)
      .overrideProvider(PaymentsService)
      .useValue(new PaymentsService(prisma, fakeProvider, credits))
      .compile();

    app = testingModule.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { rawBody: true },
    );
    await app.init();
    payments = app.get(PaymentsService);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('returns 401 for an invalid signature and credits one repeated valid event once', async () => {
    const userId = randomUUID();
    const packageId = randomUUID();

    await prisma.profile.create({
      data: {
        id: userId,
        email: `webhook-${userId}@example.test`,
        name: 'Teste E2E de webhook',
        wallet: { create: { balance: 0 } },
      },
    });
    await prisma.creditPackage.create({
      data: {
        id: packageId,
        slug: `webhook-${packageId}`,
        credits: 5,
        priceCents: 1_990,
        currency: 'BRL',
        active: true,
      },
    });

    try {
      const payment = await payments.createCheckout(userId, {
        packageId,
        method: 'pix',
      });
      const providerPaymentId = (
        await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
      ).providerPaymentId;

      if (!providerPaymentId) {
        throw new Error('Fake checkout did not return a provider payment id.');
      }

      const providerEventId = randomUUID();
      const webhook = fakeProvider.createWebhook({
        providerEventId,
        providerPaymentId,
        status: 'paid',
      });
      const invalid = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/webhooks/payments/fake',
        headers: {
          'content-type': 'application/json',
          'x-fake-signature': 'invalid',
        },
        payload: webhook.body,
      });

      expect(invalid.statusCode).toBe(401);
      expect(
        await prisma.webhookEvent.count({
          where: { providerEventId },
        }),
      ).toBe(0);

      const first = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/webhooks/payments/fake',
        headers: {
          'content-type': 'application/json',
          'x-fake-signature': webhook.signature,
        },
        payload: webhook.body,
      });
      const second = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/webhooks/payments/fake',
        headers: {
          'content-type': 'application/json',
          'x-fake-signature': webhook.signature,
        },
        payload: webhook.body,
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      await expect(credits.getBalance(userId)).resolves.toBe(5);
      await expect(
        prisma.creditTransaction.count({
          where: { userId, type: 'purchase', refType: 'payment' },
        }),
      ).resolves.toBe(1);
    } finally {
      await prisma.webhookEvent.deleteMany({ where: { provider: 'fake' } });
      await prisma.payment.deleteMany({ where: { userId } });
      await prisma.creditTransaction.deleteMany({ where: { userId } });
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.profile.deleteMany({ where: { id: userId } });
      await prisma.creditPackage.deleteMany({ where: { id: packageId } });
    }
  });

  it('does not credit a valid paid event when the payment is already expired', async () => {
    const userId = randomUUID();
    const packageId = randomUUID();

    await prisma.profile.create({
      data: {
        id: userId,
        email: `webhook-expired-${userId}@example.test`,
        name: 'Teste de pagamento expirado',
        wallet: { create: { balance: 0 } },
      },
    });
    await prisma.creditPackage.create({
      data: {
        id: packageId,
        slug: `webhook-expired-${packageId}`,
        credits: 5,
        priceCents: 1_990,
        currency: 'BRL',
        active: true,
      },
    });

    try {
      const payment = await payments.createCheckout(userId, {
        packageId,
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
      const webhook = fakeProvider.createWebhook({
        providerEventId: randomUUID(),
        providerPaymentId,
        status: 'paid',
      });
      const response = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/webhooks/payments/fake',
        headers: {
          'content-type': 'application/json',
          'x-fake-signature': webhook.signature,
        },
        payload: webhook.body,
      });

      expect(response.statusCode).toBe(200);
      await expect(credits.getBalance(userId)).resolves.toBe(0);
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({ status: 'expired' });
    } finally {
      await prisma.webhookEvent.deleteMany({ where: { provider: 'fake' } });
      await prisma.payment.deleteMany({ where: { userId } });
      await prisma.creditTransaction.deleteMany({ where: { userId } });
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.profile.deleteMany({ where: { id: userId } });
      await prisma.creditPackage.deleteMany({ where: { id: packageId } });
    }
  });
});
