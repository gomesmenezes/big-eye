import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { getModule } from '@big-eye/contracts';
import { CreditsService } from '@big-eye/core/credits/credits.service';
import { Prisma, QueryStatus, type PrismaClient } from '@big-eye/core/db/prisma-client';
import type { RetryInputCache } from '@big-eye/core/queries/input-retry-cache';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { PRISMA } from '../db/database.module.js';

import {
  isoDate,
  parseCursor,
  parseLimit,
  parseOptionalDate,
  parseOptionalText,
  writeAudit,
} from './admin.utils.js';

export const ADMIN_QUERY_QUEUE = Symbol('ADMIN_QUERY_QUEUE');
export const ADMIN_RETRY_INPUT_CACHE = Symbol('ADMIN_RETRY_INPUT_CACHE');

export type AdminQueryQueue = {
  add(
    name: string,
    data: { queryId: string },
    options?: { jobId?: string },
  ): Promise<unknown>;
};

const queryStatus = z.enum(['pending', 'running', 'succeeded', 'failed', 'refunded']);

type QueryWithEvents = {
  id: string;
  userId: string;
  moduleSlug: string;
  mode: string;
  status: string;
  creditsCharged: number;
  inputHash: string;
  inputMasked: string;
  input: Prisma.JsonValue | null;
  idempotencyKey: string | null;
  providerRequestId: string | null;
  attempts: number;
  nextPollAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  profile?: { id: string; email: string; name: string };
  events?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    source: string;
    message: string;
    createdAt: Date;
  }>;
};

@ApiTags('admin/queries')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/queries')
export class AdminQueriesController {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CreditsService) private readonly credits: CreditsService,
    @Inject(ADMIN_RETRY_INPUT_CACHE) private readonly retryInputCache: RetryInputCache,
    @Inject(ADMIN_QUERY_QUEUE) private readonly queryQueue: AdminQueryQueue,
  ) {}

  @Get()
  async list(
    @Query('userId') userId: string | undefined,
    @Query('module') moduleSlug: string | undefined,
    @Query('status') rawStatus: string | undefined,
    @Query('from') fromValue: string | undefined,
    @Query('to') toValue: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ) {
    const limit = parseLimit(rawLimit);
    const from = parseOptionalDate(fromValue);
    const to = parseOptionalDate(toValue);
    const moduleFilter = parseOptionalText(moduleSlug, 100);

    if (from && to && from > to) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    let status: QueryStatus | undefined;
    if (rawStatus !== undefined) {
      const parsedStatus = queryStatus.safeParse(rawStatus);
      if (!parsedStatus.success) {
        throw new BadRequestException({ code: 'INVALID_INPUT' });
      }
      status = parsedStatus.data as QueryStatus;
    }

    if (userId !== undefined && !z.string().uuid().safeParse(userId).success) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    const baseWhere: Prisma.QueryWhereInput = {
      ...(userId ? { userId } : {}),
      ...(moduleFilter ? { moduleSlug: moduleFilter } : {}),
      ...(status ? { status } : {}),
      ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };

    let where: Prisma.QueryWhereInput = baseWhere;
    const parsedCursor = parseCursor(cursor);
    if (parsedCursor) {
      const cursorRow = await this.prisma.query.findFirst({
        where: { AND: [baseWhere, { id: parsedCursor }] },
        select: { id: true, createdAt: true },
      });

      if (!cursorRow) {
        return { items: [], nextCursor: null };
      }

      where = {
        ...baseWhere,
        OR: [
          { createdAt: { lt: cursorRow.createdAt } },
          { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
        ],
      };
    }

    const queries = await this.prisma.query.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: querySelect,
    });

    const hasNext = queries.length > limit;
    const items = queries.slice(0, limit).map(toQuerySummary);

    return {
      items,
      nextCursor: hasNext ? items.at(-1)?.id ?? null : null,
    };
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) queryId: string) {
    const query = await this.prisma.query.findUnique({
      where: { id: queryId },
      select: {
        ...querySelect,
        profile: { select: { id: true, email: true, name: true } },
        events: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            source: true,
            message: true,
            createdAt: true,
          },
        },
      },
    });

    if (!query) {
      throw new NotFoundException();
    }

    return toQueryDetail(query);
  }

  @Post(':id/retry')
  async retry(
    @CurrentUser() admin: ApiUser,
    @Param('id', new ParseUUIDPipe()) queryId: string,
  ) {
    const current = await this.prisma.query.findUnique({
      where: { id: queryId },
      select: { status: true, input: true },
    });

    if (!current) {
      throw new NotFoundException();
    }

    if (current.status !== QueryStatus.failed && current.status !== QueryStatus.refunded) {
      throw new ConflictException({ code: 'QUERY_RETRY_NOT_AVAILABLE' });
    }

    let cachedInput: unknown = current.input;
    if (cachedInput === null) {
      try {
        cachedInput = await this.retryInputCache.get(queryId);
      } catch {
        throw new ConflictException({ code: 'QUERY_RETRY_INPUT_INVALID' });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockQuery(tx, queryId);
      const query = await tx.query.findUnique({
        where: { id: queryId },
        select: { ...querySelect },
      });

      if (!query) {
        throw new NotFoundException();
      }

      if (query.status !== QueryStatus.failed && query.status !== QueryStatus.refunded) {
        throw new ConflictException({ code: 'QUERY_RETRY_NOT_AVAILABLE' });
      }

      if (cachedInput === null || cachedInput === undefined) {
        throw new ConflictException({ code: 'QUERY_RETRY_INPUT_EXPIRED' });
      }

      const retryInput = toValidatedRetryInput(query.moduleSlug, cachedInput);
      if (!retryInput) {
        throw new ConflictException({ code: 'QUERY_RETRY_INPUT_INVALID' });
      }

      const retried = await tx.query.update({
        where: { id: queryId },
        data: {
          status: QueryStatus.pending,
          providerRequestId: null,
          attempts: 0,
          nextPollAt: null,
          errorCode: null,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          input: retryInput,
        },
        select: querySelect,
      });

      await tx.queryEvent.create({
        data: {
          queryId,
          fromStatus: query.status,
          toStatus: QueryStatus.pending,
          source: 'admin',
          message: 'Consulta reenfileirada pelo administrador.',
        },
      });
      await writeAudit(tx, {
        adminUserId: admin.id,
        targetUserId: query.userId,
        action: 'query.retry',
        payload: {
          queryId,
          idempotencyKey: query.idempotencyKey,
          inputAvailable: true,
        },
      });

      return retried;
    });

    try {
      await this.queryQueue.add('query:run', { queryId }, { jobId: `admin-retry:${queryId}:${Date.now()}` });
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await lockQuery(tx, queryId);
        const current = await tx.query.findUnique({
          where: { id: queryId },
          select: { status: true, userId: true, creditsCharged: true },
        });

        if (!current || current.status !== QueryStatus.pending) {
          return;
        }

        await tx.query.update({
          where: { id: queryId },
          data: {
            status: QueryStatus.failed,
            input: Prisma.JsonNull,
            nextPollAt: null,
            errorCode: 'QUERY_FAILED',
            errorMessage: 'A consulta não pôde ser reenfileirada.',
            finishedAt: new Date(),
          },
        });
        await tx.queryEvent.create({
          data: {
            queryId,
            fromStatus: QueryStatus.pending,
            toStatus: QueryStatus.failed,
            source: 'admin',
            message: 'A consulta não pôde ser reenfileirada.',
          },
        });
        await this.credits.refundQuery(tx, {
          userId: current.userId,
          queryId,
          amount: current.creditsCharged,
          reason: 'QUERY_FAILED',
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
            source: 'admin',
            message: 'Créditos reembolsados.',
          },
        });
        await writeAudit(tx, {
          adminUserId: admin.id,
          targetUserId: current.userId,
          action: 'query.retry.failed',
          payload: { queryId, reason: 'QUEUE_UNAVAILABLE' },
        });
      });
      throw error;
    }

    return toQuerySummary(updated);
  }

  @Post(':id/refund')
  async refund(
    @CurrentUser() admin: ApiUser,
    @Param('id', new ParseUUIDPipe()) queryId: string,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockQuery(tx, queryId);
        const query = await tx.query.findUnique({
          where: { id: queryId },
          select: {
            id: true,
            userId: true,
            status: true,
            creditsCharged: true,
          },
        });

        if (!query) {
          throw new NotFoundException();
        }

        if (query.status !== QueryStatus.refunded) {
          await this.credits.refundQuery(tx, {
            userId: query.userId,
            queryId: query.id,
            amount: query.creditsCharged,
            reason: 'ADMIN_REFUND',
          });

          await tx.query.update({
            where: { id: query.id },
            data: {
              status: QueryStatus.refunded,
              input: Prisma.JsonNull,
              nextPollAt: null,
              finishedAt: new Date(),
            },
          });
          await tx.queryEvent.create({
            data: {
              queryId: query.id,
              fromStatus: query.status,
              toStatus: QueryStatus.refunded,
              source: 'admin',
              message: 'Consulta reembolsada pelo administrador.',
            },
          });
        }

        await writeAudit(tx, {
          adminUserId: admin.id,
          targetUserId: query.userId,
          action: 'query.refund',
          payload: { queryId: query.id, alreadyRefunded: query.status === QueryStatus.refunded },
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException({ code: 'QUERY_REFUND_UNAVAILABLE' });
    }

    return this.get(queryId);
  }
}

const querySelect = {
  id: true,
  userId: true,
  moduleSlug: true,
  mode: true,
  status: true,
  creditsCharged: true,
  inputHash: true,
  inputMasked: true,
  input: true,
  idempotencyKey: true,
  providerRequestId: true,
  attempts: true,
  nextPollAt: true,
  errorCode: true,
  errorMessage: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
} as const;

function toValidatedRetryInput(
  moduleSlug: string,
  input: unknown,
): Prisma.InputJsonObject | null {
  const contract = getModule(moduleSlug);
  if (!contract) {
    return null;
  }

  const parsed = contract.input.safeParse(input);
  if (
    !parsed.success ||
    typeof parsed.data !== 'object' ||
    parsed.data === null ||
    Array.isArray(parsed.data)
  ) {
    return null;
  }

  return JSON.parse(JSON.stringify(parsed.data)) as Prisma.InputJsonObject;
}

function toQuerySummary(query: QueryWithEvents) {
  return {
    id: query.id,
    userId: query.userId,
    moduleSlug: query.moduleSlug,
    mode: query.mode,
    status: query.status,
    creditsCharged: query.creditsCharged,
    inputMasked: query.inputMasked,
    errorCode: query.errorCode,
    errorMessage: query.errorMessage,
    idempotencyKey: query.idempotencyKey,
    createdAt: query.createdAt.toISOString(),
    startedAt: isoDate(query.startedAt),
    finishedAt: isoDate(query.finishedAt),
  };
}

function toQueryDetail(query: QueryWithEvents) {
  return {
    ...toQuerySummary(query),
    inputHash: query.inputHash,
    providerRequestId: query.providerRequestId,
    attempts: query.attempts,
    nextPollAt: isoDate(query.nextPollAt),
    user: query.profile,
    events: (query.events ?? []).map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function lockQuery(tx: Prisma.TransactionClient, queryId: string): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM queries
    WHERE id = ${queryId}::uuid
    FOR UPDATE
  `;
}
