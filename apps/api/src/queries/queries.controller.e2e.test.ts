import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueriesService, type QueryView } from '@big-eye/core/queries/queries.service';

import { QueriesController } from './queries.controller.js';

const userId = 'f4b9f6a7-43b9-4b4d-8aa1-48793273cb93';

const succeededQuery: QueryView = {
  id: '6d3a4a70-4a1d-4b6f-bbe9-e6f30c8f6b7a',
  moduleSlug: 'cpf-basico',
  mode: 'sync',
  status: 'succeeded',
  creditsCharged: 1,
  inputMasked: '***.***.***-01',
  errorCode: null,
  errorMessage: null,
  createdAt: '2026-09-27T12:00:00.000Z',
  startedAt: '2026-09-27T12:00:00.000Z',
  finishedAt: '2026-09-27T12:00:00.100Z',
  data: { nome: 'Pessoa 8901', cpf: '12345678901' },
};

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: unknown }>();
    request.user = { id: userId, email: 'test@example.com', role: 'user', status: 'active' };
    return true;
  }
}

describe('QueriesController HTTP', () => {
  let app: NestFastifyApplication;
  const queriesService = {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [QueriesController],
      providers: [
        { provide: QueriesService, useValue: queriesService },
        { provide: APP_GUARD, useClass: TestAuthGuard },
      ],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('creates a synchronous query and forwards the idempotency key', async () => {
    vi.mocked(queriesService.create).mockResolvedValue(succeededQuery);

    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/queries',
      headers: { 'idempotency-key': 'request-1' },
      payload: { moduleSlug: 'cpf-basico', input: { cpf: '12345678901' } },
    });

    expect(response.statusCode).toBe(200);
    expect(queriesService.create).toHaveBeenCalledWith(
      userId,
      'cpf-basico',
      { cpf: '12345678901' },
      'request-1',
    );
  });

  it('returns 202 for an asynchronous query', async () => {
    vi.mocked(queriesService.create).mockResolvedValue({
      ...succeededQuery,
      mode: 'async',
      status: 'pending',
      data: undefined,
    });

    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/queries',
      payload: { moduleSlug: 'dossie-360', input: { cpf: '12345678901' } },
    });

    expect(response.statusCode).toBe(202);
  });

  it('rejects a body that does not contain a module and input object', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'POST',
      url: '/queries',
      payload: { moduleSlug: 'cpf-basico', input: '12345678901' },
    });

    expect(response.statusCode).toBe(400);
    expect(queriesService.create).not.toHaveBeenCalled();
  });
});
