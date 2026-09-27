import { randomUUID } from 'node:crypto';

import {
  ERROR_CODES,
  getModule,
  QueryDTO,
  type ErrorCode,
  type QueryDTOType,
} from '@big-eye/contracts';

import type { CreditsService } from '../credits/credits.service.js';
import { InsufficientCreditsError } from '../credits/credits.service.js';
import { Prisma, type PrismaClient, type QueryStatus } from '../db/prisma-client.js';
import {
  ProviderError,
  type ProviderClient,
  type ProviderResult,
} from '../provider/provider.client.js';
import { getProviderClient } from '../provider/registry.js';
import { enqueueQueryRun } from '../queues/queues.js';
import type { ResultCache } from '../result-cache.js';

import { retryInputCache, type RetryInputCache } from './input-retry-cache.js';
import { maskInput } from './mask.js';
import { lockQuery } from './query-lock.js';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const DEFAULT_QUERY_TIMEOUT_MS = 15_000;

type QueryRow = {
  id: string;
  userId: string;
  moduleSlug: string;
  mode: 'sync' | 'async';
  status: QueryStatus;
  creditsCharged: number;
  inputMasked: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type QueryRunEnqueuer = (queryId: string) => Promise<void>;

export type QueryView = QueryDTOType;

export class QueryServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    message = 'A consulta não pôde ser concluída.',
    readonly cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'QueryServiceError';
  }
}

export class QueryNotFoundError extends Error {
  constructor() {
    super('Consulta não encontrada.');
    this.name = 'QueryNotFoundError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return isRecord(error) && error.code === 'P2002';
}

function asJsonObject(input: Record<string, unknown>): Prisma.InputJsonObject {
  // HTTP inputs are JSON values. Cloning here also removes values such as
  // undefined that Prisma cannot encode as a JSON column value.
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonObject;
}

function normalizeLimit(limit: number | undefined): number {
  const value = limit ?? DEFAULT_LIST_LIMIT;

  if (!Number.isInteger(value) || value < 1 || value > MAX_LIST_LIMIT) {
    throw new QueryServiceError(ERROR_CODES.INVALID_INPUT, 'Limite de consultas inválido.');
  }

  return value;
}

function timeoutMs(): number {
  const value = Number(process.env.QUERY_TIMEOUT_MS ?? DEFAULT_QUERY_TIMEOUT_MS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_QUERY_TIMEOUT_MS;
}

function safeFailure(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof ProviderError) {
    if (error.code === ERROR_CODES.PROVIDER_UNAVAILABLE) {
      return {
        code: ERROR_CODES.PROVIDER_UNAVAILABLE,
        message: 'Provedor temporariamente indisponível.',
      };
    }

    return {
      code: ERROR_CODES.QUERY_FAILED,
      message: 'A resposta do provedor não pôde ser validada.',
    };
  }

  return {
    code: ERROR_CODES.QUERY_FAILED,
    message: 'A consulta não pôde ser concluída.',
  };
}

function toQueryView(query: QueryRow, data?: unknown, resultExpired?: boolean): QueryView {
  return QueryDTO.parse({
    id: query.id,
    moduleSlug: query.moduleSlug,
    mode: query.mode,
    status: query.status,
    creditsCharged: query.creditsCharged,
    inputMasked: query.inputMasked,
    errorCode: query.errorCode,
    errorMessage: query.errorMessage,
    createdAt: query.createdAt.toISOString(),
    startedAt: query.startedAt?.toISOString() ?? null,
    finishedAt: query.finishedAt?.toISOString() ?? null,
    ...(data === undefined ? {} : { data }),
    ...(resultExpired === undefined ? {} : { resultExpired }),
  });
}

function querySelect() {
  return {
    id: true,
    userId: true,
    moduleSlug: true,
    mode: true,
    status: true,
    creditsCharged: true,
    inputMasked: true,
    errorCode: true,
    errorMessage: true,
    createdAt: true,
    startedAt: true,
    finishedAt: true,
  } as const;
}

function isTerminalQueryStatus(status: QueryStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'refunded';
}

export class QueriesService {
  constructor(
    private readonly client: PrismaClient,
    private readonly creditsService: CreditsService,
    private readonly provider: ProviderClient = getProviderClient(),
    private readonly resultCache?: ResultCache,
    private readonly enqueue: QueryRunEnqueuer = enqueueQueryRun,
    private readonly retryInput: RetryInputCache = retryInputCache,
  ) {}

  async create(
    userId: string,
    moduleSlug: string,
    input: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<QueryView> {
    const normalizedIdempotencyKey = idempotencyKey?.trim() || undefined;
    const id = randomUUID();

    // Check this before validating a retry body. A retry is identified by its
    // key and returns the original query, including when its new body differs.
    if (normalizedIdempotencyKey) {
      const existing = await this.findByIdempotencyKey(userId, normalizedIdempotencyKey);
      if (existing) {
        return this.viewWithCachedResult(existing);
      }
    }

    const contract = getModule(moduleSlug);

    if (!contract) {
      throw new QueryServiceError(ERROR_CODES.MODULE_NOT_FOUND, 'Módulo não encontrado.');
    }

    const parsedInput = contract.input.safeParse(input);

    if (!parsedInput.success) {
      throw new QueryServiceError(ERROR_CODES.INVALID_INPUT, 'A entrada da consulta é inválida.');
    }

    if (!contract.implemented) {
      throw new QueryServiceError(
        ERROR_CODES.PROVIDER_UNAVAILABLE,
        'Módulo temporariamente indisponível.',
      );
    }

    const validatedInput = parsedInput.data as Record<string, unknown>;
    const { masked, hash } = maskInput(moduleSlug, validatedInput);

    try {
      const query = await this.client.$transaction(async (tx) => {
        const created = await tx.query.create({
          data: {
            id,
            userId,
            moduleSlug: contract.slug,
            mode: contract.mode,
            status: 'pending',
            creditsCharged: contract.custoCreditos,
            inputHash: hash,
            inputMasked: masked,
            input: asJsonObject(validatedInput),
            idempotencyKey: normalizedIdempotencyKey,
          },
          select: querySelect(),
        });

        await this.creditsService.debitForQuery(tx, {
          userId,
          queryId: created.id,
          amount: contract.custoCreditos,
          description: `Consulta ${contract.slug}`,
        });
        await this.recordTransition(tx, created.id, null, 'pending', 'Consulta criada.');
        return created;
      });

      await this.cacheRetryInput(query.id, validatedInput);

      if (contract.mode === 'async') {
        try {
          await this.enqueue(query.id);
          return toQueryView(query);
        } catch (error) {
          return this.client.$transaction((tx) =>
            this.failAndRefund(tx, query, error),
          );
        }
      }

      const running = await this.client.$transaction(async (tx) => {
        await lockQuery(tx, query.id);
        const current = await tx.query.findUnique({
          where: { id: query.id },
          select: querySelect(),
        });

        if (!current || current.status !== 'pending') {
          return current;
        }

        const updated = await tx.query.update({
          where: { id: query.id },
          data: { status: 'running', startedAt: new Date() },
          select: querySelect(),
        });
        await this.recordTransition(tx, query.id, 'pending', 'running', 'Consulta iniciada.');
        return updated;
      });

      if (!running) {
        throw new QueryNotFoundError();
      }

      if (running.status !== 'running') {
        return this.viewWithCachedResult(running);
      }

      try {
        const providerResult = await this.executeWithTimeout({
          module: contract.slug,
          input: validatedInput,
        });
        const data = this.validateResult(contract.output, providerResult);
        const completion = await this.client.$transaction(async (tx) => {
          await lockQuery(tx, query.id);
          const current = await tx.query.findUnique({
            where: { id: query.id },
            select: querySelect(),
          });

          if (!current || current.status !== 'running') {
            return { query: current, transitioned: false };
          }

          const updated = await tx.query.update({
            where: { id: query.id },
            data: {
              status: 'succeeded',
              input: Prisma.JsonNull,
              finishedAt: new Date(),
            },
            select: querySelect(),
          });
          await this.recordTransition(tx, query.id, 'running', 'succeeded', 'Consulta concluída.');
          return { query: updated, transitioned: true };
        });

        if (!completion.query || !completion.transitioned) {
          return this.viewWithCachedResult(completion.query ?? running);
        }

        await this.cacheResult(query.id, data);
        await this.deleteRetryInput(query.id);
        return toQueryView(completion.query, data);
      } catch (error) {
        return this.client.$transaction((tx) => this.failAndRefund(tx, running, error));
      }
    } catch (error) {
      if (normalizedIdempotencyKey && isUniqueConstraintError(error)) {
        const existing = await this.findByIdempotencyKey(userId, normalizedIdempotencyKey);
        if (existing) {
          return this.viewWithCachedResult(existing);
        }
      }

      if (error instanceof InsufficientCreditsError) {
        throw new QueryServiceError(ERROR_CODES.INSUFFICIENT_CREDITS, error.message, error);
      }

      throw error;
    }
  }

  async get(userId: string, id: string): Promise<QueryView> {
    const query = await this.findOwnedQuery(userId, id);

    if (!query) {
      throw new QueryNotFoundError();
    }

    return this.viewWithCachedResult(query);
  }

  async list(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<QueryView[]> {
    const limit = normalizeLimit(options.limit);
    let where: Prisma.QueryWhereInput = { userId };

    if (options.cursor) {
      const cursor = await this.client.query.findFirst({
        where: { id: options.cursor, userId },
        select: { id: true, createdAt: true },
      });

      if (!cursor) {
        return [];
      }

      where = {
        userId,
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      };
    }

    const queries = await this.client.query.findMany({
      where,
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: querySelect(),
    });

    return queries.map((query) => toQueryView(query));
  }

  private findOwnedQuery(userId: string, id: string): Promise<QueryRow | null> {
    return this.client.query.findFirst({
      where: { id, userId },
      select: querySelect(),
    });
  }

  private findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<QueryRow | null> {
    return this.client.query.findFirst({
      where: { userId, idempotencyKey },
      select: querySelect(),
    });
  }

  private async viewWithCachedResult(query: QueryRow): Promise<QueryView> {
    if (query.status !== 'succeeded' || !this.resultCache) {
      return toQueryView(query);
    }

    try {
      const cached = await this.resultCache.get(query.id);
      return cached ? toQueryView(query, cached.data) : toQueryView(query, undefined, true);
    } catch {
      return toQueryView(query, undefined, true);
    }
  }

  private async cacheResult(queryId: string, data: unknown): Promise<void> {
    if (!this.resultCache) {
      return;
    }

    try {
      await this.resultCache.set(queryId, { data });
    } catch {
      // The database keeps query metadata. A cache outage must not turn a
      // successful provider response into a technical failure/refund.
    }
  }

  private async cacheRetryInput(
    queryId: string,
    input: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.retryInput.set(queryId, input);
    } catch {
      // Retry input is a recovery aid. A cache outage must not turn a newly
      // created, already debited query into a technical failure.
    }
  }

  private async deleteRetryInput(queryId: string): Promise<void> {
    try {
      await this.retryInput.del(queryId);
    } catch {
      // The successful query state is already durable. Cache cleanup remains
      // best effort when Redis is unavailable.
    }
  }

  private async executeWithTimeout(request: {
    module: string;
    input: Record<string, unknown>;
  }): Promise<ProviderResult> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new ProviderError('PROVIDER_UNAVAILABLE', 'O tempo do provedor expirou.')),
        timeoutMs(),
      );
    });

    try {
      return await Promise.race([this.provider.execute(request), timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private validateResult(outputSchema: { safeParse(value: unknown): { success: boolean; data?: unknown } }, result: ProviderResult): unknown {
    if (result.kind !== 'result') {
      throw new ProviderError('QUERY_FAILED', 'O provedor não devolveu um resultado síncrono.');
    }

    const parsed = outputSchema.safeParse(result.data);

    if (!parsed.success) {
      throw new ProviderError('QUERY_FAILED', 'O provedor devolveu um resultado inválido.');
    }

    return parsed.data;
  }

  private async failAndRefund(
    tx: Prisma.TransactionClient,
    query: QueryRow,
    error: unknown,
  ): Promise<QueryView> {
    await lockQuery(tx, query.id);
    const current = await tx.query.findUnique({
      where: { id: query.id },
      select: querySelect(),
    });

    if (!current) {
      throw new QueryNotFoundError();
    }

    if (isTerminalQueryStatus(current.status)) {
      return toQueryView(current);
    }

    const failure = safeFailure(error);
    await tx.query.update({
      where: { id: query.id },
      data: {
        status: 'failed',
        errorCode: failure.code,
        errorMessage: failure.message,
        input: Prisma.JsonNull,
        finishedAt: new Date(),
      },
      select: querySelect(),
    });
    await this.recordTransition(tx, query.id, current.status, 'failed', failure.message);

    await this.creditsService.refundQuery(tx, {
      userId: current.userId,
      queryId: query.id,
      amount: current.creditsCharged,
      reason: failure.message,
    });

    const refunded = await tx.query.update({
      where: { id: query.id },
      data: { status: 'refunded' },
      select: querySelect(),
    });
    await this.recordTransition(tx, query.id, 'failed', 'refunded', 'Créditos reembolsados.');
    return toQueryView(refunded);
  }

  private async recordTransition(
    tx: Prisma.TransactionClient,
    queryId: string,
    fromStatus: QueryStatus | null,
    toStatus: QueryStatus,
    message: string,
  ): Promise<void> {
    await tx.queryEvent.create({
      data: {
        queryId,
        fromStatus,
        toStatus,
        source: 'api',
        message,
      },
    });
  }
}
