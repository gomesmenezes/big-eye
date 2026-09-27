import { randomUUID } from 'node:crypto';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { CreditsService } from '@big-eye/core/credits/credits.service';
import { Prisma, PrismaClient } from '@big-eye/core/db/prisma-client';

import { AppModule } from '../app.module.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestWithUser } from '../auth/auth.types.js';
import { PRISMA } from '../db/database.module.js';

import {
  ADMIN_QUERY_QUEUE,
  ADMIN_RETRY_INPUT_CACHE,
  type AdminQueryQueue,
} from './admin-queries.controller.js';

const databaseUrl =
  process.env.BIGEYE_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

class TestAuthGuard implements CanActivate {
  constructor(private readonly adminId: string, private readonly userId: string) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const isAdmin =
      (request.headers as Record<string, string | undefined>)['x-test-role'] === 'admin';
    request.user = {
      id: isAdmin ? this.adminId : this.userId,
      email: isAdmin ? 'admin@example.test' : 'user@example.test',
      role: isAdmin ? 'admin' : 'user',
      status: 'active',
    };
    return true;
  }
}

describe('admin API', () => {
  let app: NestFastifyApplication;
  const adminId = randomUUID();
  const userId = randomUUID();
  const queryId = randomUUID();
  const packageId = randomUUID();
  const queue: AdminQueryQueue = {
    add: vi.fn().mockResolvedValue(undefined),
  };
  let dashboardFrom: string;
  const retryInput = { cpf: '12345678901' };
  const retryInputs = {
    get: vi.fn().mockResolvedValue(retryInput),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };
  type TestResponse = {
    statusCode: number;
    json(): Record<string, unknown>;
  };

  beforeAll(async () => {
    await prisma.$connect();
    dashboardFrom = new Date().toISOString();
    await prisma.profile.createMany({
      data: [
        { id: adminId, email: `admin-${adminId}@example.test`, name: 'Admin', role: 'admin' },
        { id: userId, email: `user-${userId}@example.test`, name: 'Usuário' },
      ],
    });
    await prisma.wallet.create({ data: { userId, balance: 0 } });
    await prisma.creditPackage.create({
      data: {
        id: packageId,
        slug: `admin-${packageId}`,
        credits: 10,
        priceCents: 1_000,
        currency: 'BRL',
        active: true,
      },
    });
    await prisma.query.create({
      data: {
        id: queryId,
        userId,
        moduleSlug: 'cpf-basico',
        mode: 'sync',
        status: 'failed',
        creditsCharged: 1,
        inputHash: 'a'.repeat(64),
        inputMasked: '***.***.***-01',
        input: Prisma.JsonNull,
        idempotencyKey: `admin-retry-${queryId}`,
      },
    });
    await prisma.queryEvent.create({
      data: {
        queryId,
        toStatus: 'failed',
        source: 'api',
        message: 'Consulta de teste falhou.',
      },
    });

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    await prisma.creditTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'consume',
        amount: -1,
        balanceAfter: 0,
        refType: 'query',
        refId: queryId,
        description: 'Consulta de teste',
        idempotencyKey: queryId,
      },
    });

    const testingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRISMA)
      .useValue(prisma)
      .overrideProvider(CreditsService)
      .useValue(new CreditsService(prisma))
      .overrideProvider(AuthGuard)
      .useValue(new TestAuthGuard(adminId, userId))
      .overrideProvider(ADMIN_QUERY_QUEUE)
      .useValue(queue)
      .overrideProvider(ADMIN_RETRY_INPUT_CACHE)
      .useValue(retryInputs)
      .compile();

    app = testingModule.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.queryEvent.deleteMany({ where: { queryId } });
    await prisma.creditTransaction.deleteMany({ where: { userId } });
    await prisma.query.deleteMany({ where: { id: queryId } });
    await prisma.adminAuditLog.deleteMany({ where: { OR: [{ adminUserId: adminId }, { targetUserId: userId }] } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.creditPackage.deleteMany({ where: { id: packageId } });
    await prisma.profile.deleteMany({ where: { id: { in: [adminId, userId] } } });
    await prisma.$disconnect();
  });

  function request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    role: 'admin' | 'user' = 'admin',
    payload?: Record<string, unknown>,
  ) {
    return app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method,
        url,
        headers: { 'x-test-role': role },
        ...(payload === undefined ? {} : { payload }),
      }) as unknown as Promise<TestResponse>;
  }

  it('rejects a regular user on every admin surface', async () => {
    const routes: Array<{
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      url: string;
      payload?: Record<string, unknown>;
    }> = [
      { method: 'GET', url: '/admin/users' },
      { method: 'GET', url: `/admin/users/${userId}` },
      { method: 'PATCH', url: `/admin/users/${userId}/wallet`, payload: { amount: 1, reason: 'x' } },
      { method: 'PATCH', url: `/admin/users/${userId}/status`, payload: { status: 'active' } },
      { method: 'GET', url: '/admin/queries' },
      { method: 'GET', url: `/admin/queries/${queryId}` },
      { method: 'POST', url: `/admin/queries/${queryId}/retry` },
      { method: 'POST', url: `/admin/queries/${queryId}/refund` },
      { method: 'GET', url: '/admin/payments' },
      { method: 'GET', url: `/admin/payments/${queryId}` },
      { method: 'POST', url: `/admin/payments/${queryId}/reprocess` },
      { method: 'GET', url: '/admin/packages' },
      { method: 'POST', url: '/admin/packages', payload: { slug: 'x', credits: 1, priceCents: 1 } },
      { method: 'PATCH', url: `/admin/packages/${packageId}`, payload: { active: false } },
      { method: 'DELETE', url: `/admin/packages/${packageId}` },
      { method: 'GET', url: '/admin/dashboard' },
    ];

    for (const route of routes) {
      const response = await request(route.method, route.url, 'user', route.payload);
      expect(response.statusCode, `${route.method} ${route.url}`).toBe(403);
    }
  });

  it('adjusts a wallet and writes an audit row', async () => {
    const response = await request('PATCH', `/admin/users/${userId}/wallet`, 'admin', {
      amount: 2,
      reason: 'Correção manual de teste',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ userId, balance: 2 });
    await expect(
      prisma.creditTransaction.count({
        where: { userId, type: 'admin_adjust', refType: 'admin' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.adminAuditLog.count({ where: { adminUserId: adminId, action: 'wallet.adjust' } }),
    ).resolves.toBe(1);
  });

  it('retries with the existing input without creating another debit', async () => {
    const response = await request('POST', `/admin/queries/${queryId}/retry`);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: queryId, status: 'pending' });
    expect(retryInputs.get).toHaveBeenCalledWith(queryId);
    expect(queue.add).toHaveBeenCalledWith(
      'query:run',
      { queryId },
      expect.objectContaining({ jobId: expect.stringContaining(`admin-retry:${queryId}:`) }),
    );
    await expect(
      prisma.creditTransaction.count({ where: { refId: queryId, type: 'consume' } }),
    ).resolves.toBe(1);
    await expect(prisma.query.findUniqueOrThrow({ where: { id: queryId } })).resolves.toMatchObject({
      idempotencyKey: `admin-retry-${queryId}`,
      input: retryInput,
    });

    const detail = await request('GET', `/admin/queries/${queryId}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).not.toHaveProperty('input');
  });

  it('refunds idempotently and exposes dashboard aggregates', async () => {
    const first = await request('POST', `/admin/queries/${queryId}/refund`);
    const second = await request('POST', `/admin/queries/${queryId}/refund`);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    await expect(
      prisma.creditTransaction.count({ where: { refId: queryId, type: 'refund' } }),
    ).resolves.toBe(1);
    await expect(
      prisma.wallet.findUniqueOrThrow({ where: { userId } }),
    ).resolves.toMatchObject({ balance: 3 });

    const dashboard = await request('GET', `/admin/dashboard?from=${encodeURIComponent(dashboardFrom)}`);
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      newUsers: 2,
      creditsConsumed: 1,
      failedQueries: 1,
      totalQueries: 1,
      failureRate: 1,
    });
  });

  it('lists and creates admin packages', async () => {
    const listed = await request('GET', '/admin/packages');
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toEqual(expect.arrayContaining([expect.objectContaining({ id: packageId })]));

    const created = await request('POST', '/admin/packages', 'admin', {
      slug: `admin-created-${randomUUID()}`,
      credits: 5,
      priceCents: 500,
    });
    expect(created.statusCode).toBe(201);
    const createdId = created.json().id as string;
    await prisma.creditPackage.delete({ where: { id: createdId } });
  });
});
