import { Prisma, QueryStatus } from '@big-eye/core/db/prisma-client';
import { lockQuery } from '@big-eye/core/queries/query-lock';
import type {
  QueryEventPayload,
  QueryEventsBus,
} from '@big-eye/core/query-events';
import type { ResultCache } from '@big-eye/core/result-cache';

import type { WorkerDependencies } from './context.js';

export const TERMINAL_QUERY_STATUSES = new Set<QueryStatus>([
  QueryStatus.succeeded,
  QueryStatus.failed,
  QueryStatus.refunded,
]);

export function isTerminalStatus(status: QueryStatus): boolean {
  return TERMINAL_QUERY_STATUSES.has(status);
}

export function asInputRecord(input: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('A entrada da consulta não está disponível.');
  }

  return input as Record<string, unknown>;
}

export function genericErrorMessage(): string {
  return 'Não foi possível concluir a consulta.';
}

export function errorCodeFor(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return 'QUERY_FAILED';
}

export async function publishSafely(
  bus: QueryEventsBus,
  queryId: string,
  event: QueryEventPayload,
): Promise<void> {
  try {
    await bus.publish(queryId, event);
  } catch {
    // Redis delivery is best effort. The persisted query state remains the
    // source of truth and a reconnecting SSE client reads it again.
  }
}

export async function deleteCachedResultSafely(
  cache: ResultCache,
  queryId: string,
): Promise<void> {
  try {
    await cache.del(queryId);
  } catch {
    // A stale cache entry cannot make a failed query look successful because
    // GET/SSE always check the persisted status before reading the cache.
  }
}

export async function deleteRetryInputSafely(
  dependencies: WorkerDependencies,
  queryId: string,
): Promise<void> {
  try {
    await dependencies.retryInputCache.del(queryId);
  } catch {
    // The query state is already durable. Cache cleanup remains best effort
    // when Redis is unavailable.
  }
}

export async function markRunning(
  dependencies: WorkerDependencies,
  queryId: string,
): Promise<boolean> {
  const changed = await dependencies.prisma.$transaction(async (tx) => {
    await lockQuery(tx, queryId);
    const query = await tx.query.findUnique({
      where: { id: queryId },
      select: { status: true, startedAt: true },
    });

    if (!query || isTerminalStatus(query.status)) {
      return false;
    }

    if (query.status === QueryStatus.running) {
      return true;
    }

    await tx.query.update({
      where: { id: queryId },
      data: {
        status: QueryStatus.running,
        startedAt: query.startedAt ?? dependencies.now(),
      },
    });
    await tx.queryEvent.create({
      data: {
        queryId,
        fromStatus: query.status,
        toStatus: QueryStatus.running,
        source: 'worker',
        message: 'Consulta encaminhada para processamento.',
      },
    });
    return true;
  });

  if (changed) {
    await publishSafely(dependencies.eventsBus, queryId, {
      status: QueryStatus.running,
    });
  }

  return changed;
}

export async function finishWithResult(
  dependencies: WorkerDependencies,
  queryId: string,
  data: unknown,
): Promise<void> {
  const transitioned = await dependencies.prisma.$transaction(async (tx) => {
    await lockQuery(tx, queryId);
    const query = await tx.query.findUnique({
      where: { id: queryId },
      select: { status: true },
    });

    if (!query || isTerminalStatus(query.status)) {
      return false;
    }

    await tx.query.update({
      where: { id: queryId },
      data: {
        status: QueryStatus.succeeded,
        input: Prisma.JsonNull,
        nextPollAt: null,
        errorCode: null,
        errorMessage: null,
        finishedAt: dependencies.now(),
      },
    });
    await tx.queryEvent.create({
      data: {
        queryId,
        fromStatus: query.status,
        toStatus: QueryStatus.succeeded,
        source: 'provider',
        message: 'Consulta concluída.',
      },
    });
    return true;
  });

  if (!transitioned) {
    return;
  }

  try {
    await dependencies.resultCache.set(queryId, { data });
  } catch {
    // The terminal state is durable. A cache outage is surfaced to clients as
    // resultExpired until a later result write or retry repopulates it.
  }
  await deleteRetryInputSafely(dependencies, queryId);
  await publishSafely(dependencies.eventsBus, queryId, {
    status: QueryStatus.succeeded,
  });
}

export async function finishWithFailure(
  dependencies: WorkerDependencies,
  queryId: string,
  error: unknown,
): Promise<void> {
  const errorCode = errorCodeFor(error);

  const transitioned = await dependencies.prisma.$transaction(async (tx) => {
    await lockQuery(tx, queryId);
    const query = await tx.query.findUnique({
      where: { id: queryId },
      select: {
        userId: true,
        status: true,
        creditsCharged: true,
      },
    });

    if (!query || isTerminalStatus(query.status)) {
      return false;
    }

    await dependencies.credits.refundQuery(tx, {
      userId: query.userId,
      queryId,
      amount: query.creditsCharged,
      reason: errorCode,
    });
    await tx.query.update({
      where: { id: queryId },
      data: {
        status: QueryStatus.failed,
        input: Prisma.JsonNull,
        nextPollAt: null,
        errorCode,
        errorMessage: genericErrorMessage(),
        finishedAt: dependencies.now(),
      },
    });
    await tx.queryEvent.create({
      data: {
        queryId,
        fromStatus: query.status,
        toStatus: QueryStatus.failed,
        source: 'worker',
        message: 'Consulta falhou e o crédito foi reembolsado.',
      },
    });
    await tx.query.update({
      where: { id: queryId },
      data: { status: QueryStatus.refunded },
    });
    await tx.queryEvent.create({
      data: {
        queryId,
        fromStatus: QueryStatus.failed,
        toStatus: QueryStatus.refunded,
        source: 'worker',
        message: 'Créditos reembolsados.',
      },
    });
    return true;
  });

  if (!transitioned) {
    return;
  }

  await deleteCachedResultSafely(dependencies.resultCache, queryId);
  await publishSafely(dependencies.eventsBus, queryId, {
    status: QueryStatus.refunded,
    errorCode,
    errorMessage: genericErrorMessage(),
  });
}
