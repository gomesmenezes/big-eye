import { CreditsService } from '../credits/credits.service.js';
import { Prisma, QueryStatus, type PrismaClient } from '../db/prisma-client.js';
import { prisma } from '../db/prisma.js';
import { queryEventsBus, type QueryEventsBus } from '../query-events.js';

import { lockQuery } from './query-lock.js';

const DEFAULT_MAX_AGE_MS = 60_000;

function configuredMaxAgeMs(): number {
  const explicit = Number(process.env.QUERY_RECONCILE_MAX_AGE_MS);
  if (Number.isInteger(explicit) && explicit > 0) {
    return explicit;
  }

  const timeout = Number(process.env.QUERY_TIMEOUT_MS);
  return Number.isInteger(timeout) && timeout > 0
    ? Math.max(timeout * 4, DEFAULT_MAX_AGE_MS)
    : DEFAULT_MAX_AGE_MS;
}

function genericErrorMessage(): string {
  return 'Não foi possível concluir a consulta.';
}

/**
 * Safety net for queries whose worker disappeared after the debit. It operates
 * on persisted state, so a client disconnect or a Redis reconnect cannot leave
 * a charge without a terminal outcome.
 */
export class ReconcileService {
  constructor(
    private readonly client: PrismaClient = prisma,
    private readonly credits: CreditsService = new CreditsService(client),
    private readonly eventsBus: QueryEventsBus = queryEventsBus,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async reconcileStuckQueries(maxAgeMs = configuredMaxAgeMs()): Promise<number> {
    if (!Number.isInteger(maxAgeMs) || maxAgeMs <= 0) {
      throw new RangeError('O limite de reconciliação deve ser positivo.');
    }

    const cutoff = new Date(this.now().getTime() - maxAgeMs);
    const candidates = await this.client.query.findMany({
      where: {
        status: { in: [QueryStatus.pending, QueryStatus.running] },
        OR: [
          { createdAt: { lt: cutoff } },
          { startedAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    let reconciled = 0;
    for (const candidate of candidates) {
      const didReconcile = await this.reconcileOne(candidate.id, cutoff);
      if (didReconcile) {
        reconciled += 1;
      }
    }

    return reconciled;
  }

  private async reconcileOne(queryId: string, cutoff: Date): Promise<boolean> {
    let reconciled = false;

    try {
      reconciled = await this.client.$transaction(async (tx) => {
        await lockQuery(tx, queryId);
        const query = await tx.query.findUnique({
          where: { id: queryId },
          select: {
            id: true,
            userId: true,
            status: true,
            creditsCharged: true,
            createdAt: true,
            startedAt: true,
          },
        });

        if (
          !query ||
          (query.status !== QueryStatus.pending &&
            query.status !== QueryStatus.running) ||
          (query.createdAt >= cutoff &&
            (query.startedAt === null || query.startedAt >= cutoff))
        ) {
          return false;
        }

        await this.credits.refundQuery(tx, {
          userId: query.userId,
          queryId: query.id,
          amount: query.creditsCharged,
          reason: 'RECONCILIATION_TIMEOUT',
        });
        await tx.query.update({
          where: { id: query.id },
          data: {
            status: QueryStatus.failed,
            input: Prisma.JsonNull,
            nextPollAt: null,
            errorCode: 'QUERY_FAILED',
            errorMessage: genericErrorMessage(),
            finishedAt: this.now(),
          },
        });
        await tx.queryEvent.create({
          data: {
            queryId: query.id,
            fromStatus: query.status,
            toStatus: QueryStatus.failed,
            source: 'worker',
            message: 'Consulta reconciliada após exceder o tempo limite.',
          },
        });
        await tx.query.update({
          where: { id: query.id },
          data: { status: QueryStatus.refunded },
        });
        await tx.queryEvent.create({
          data: {
            queryId: query.id,
            fromStatus: QueryStatus.failed,
            toStatus: QueryStatus.refunded,
            source: 'worker',
            message: 'Créditos reembolsados.',
          },
        });
        return true;
      });
    } catch {
      // A concurrent worker may have completed the query, or the refund may
      // need another pass. Leave it visible for the next reconciliation run.
      return false;
    }

    if (reconciled) {
      try {
        await this.eventsBus.publish(queryId, {
          status: QueryStatus.refunded,
          errorCode: 'QUERY_FAILED',
          errorMessage: genericErrorMessage(),
        });
      } catch {
        // The API can recover the final state from Postgres after reconnecting.
      }
    }

    return reconciled;
  }
}
