import {
  BadRequestException,
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

import { CreditsService } from '@big-eye/core/credits/credits.service';
import type {
  PaymentStatus,
  Prisma,
  PrismaClient,
} from '@big-eye/core/db/prisma-client';
import { getPaymentProvider, type ProviderPaymentStatus } from '@big-eye/core/payments';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { PRISMA } from '../db/database.module.js';

import { isoDate, parseLimit, writeAudit } from './admin.utils.js';

const paymentStatus = z.enum(['pending', 'paid', 'failed', 'expired', 'refunded']);
const STALE_PAYMENT_AGE_MS = 24 * 60 * 60 * 1000;

@ApiTags('admin/payments')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CreditsService) private readonly credits: CreditsService,
  ) {}

  @Get()
  async list(
    @Query('status') rawStatus: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ) {
    const limit = parseLimit(rawLimit);
    let status: PaymentStatus | undefined;

    if (rawStatus !== undefined) {
      const parsed = paymentStatus.safeParse(rawStatus);
      if (!parsed.success) {
        throw new BadRequestException({ code: 'INVALID_INPUT' });
      }
      status = parsed.data as PaymentStatus;
    }

    if (userId !== undefined && !z.string().uuid().safeParse(userId).success) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    const baseWhere: Prisma.PaymentWhereInput = {
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
    };
    let where: Prisma.PaymentWhereInput = baseWhere;

    if (cursor) {
      const cursorRow = await this.prisma.payment.findUnique({
        where: { id: cursor },
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

    const payments = await this.prisma.payment.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: paymentSelect,
    });
    const hasNext = payments.length > limit;
    const items = payments.slice(0, limit).map(toPaymentView);

    return {
      items,
      nextCursor: hasNext ? items.at(-1)?.id ?? null : null,
    };
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: paymentSelect,
    });

    if (!payment) {
      throw new NotFoundException();
    }

    return toPaymentView(payment);
  }

  @Post(':id/reprocess')
  async reprocess(
    @CurrentUser() admin: ApiUser,
    @Param('id', new ParseUUIDPipe()) paymentId: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        providerPaymentId: true,
        status: true,
      },
    });

    if (!payment) {
      throw new NotFoundException();
    }

    let providerStatus: ProviderPaymentStatus = 'pending';
    if (payment.providerPaymentId) {
      try {
        providerStatus = await getPaymentProvider().getStatus(payment.providerPaymentId);
      } catch {
        throw new BadRequestException({ code: 'PAYMENT_REPROCESS_FAILED' });
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await lockPayment(tx, paymentId);
      const current = await tx.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          userId: true,
          credits: true,
          status: true,
          providerPaymentId: true,
          pixExpiresAt: true,
          createdAt: true,
        },
      });

      if (!current) {
        throw new NotFoundException();
      }

      if (current.status === 'pending' && providerStatus !== 'pending') {
        const expired =
          providerStatus === 'paid' && hasPaymentExpired(current, new Date());

        if (providerStatus === 'paid' && !expired) {
          await this.credits.creditPurchase(tx, {
            userId: current.userId,
            paymentId: current.id,
            amount: current.credits,
          });
        }

        const nextStatus = expired ? 'expired' : providerStatus;
        await tx.payment.update({
          where: { id: current.id },
          data: {
            status: nextStatus,
            ...(nextStatus === 'paid' ? { paidAt: new Date() } : {}),
          },
        });
      }

      await writeAudit(tx, {
        adminUserId: admin.id,
        targetUserId: current.userId,
        action: 'payment.reprocess',
        payload: {
          paymentId: current.id,
          providerPaymentId: current.providerPaymentId,
          providerStatus,
          previousStatus: current.status,
        },
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: current.id },
        select: paymentSelect,
      });
    });

    return toPaymentView(result);
  }
}

function hasPaymentExpired(
  payment: { pixExpiresAt: Date | null; createdAt: Date },
  now: Date,
): boolean {
  const expiresAt =
    payment.pixExpiresAt ??
    new Date(payment.createdAt.getTime() + STALE_PAYMENT_AGE_MS);

  return now >= expiresAt;
}

const paymentSelect = {
  id: true,
  userId: true,
  provider: true,
  providerPaymentId: true,
  method: true,
  amountCents: true,
  credits: true,
  status: true,
  pixQrCode: true,
  pixExpiresAt: true,
  paidAt: true,
  createdAt: true,
} as const;

function toPaymentView(payment: {
  id: string;
  userId: string;
  provider: string;
  providerPaymentId: string | null;
  method: string;
  amountCents: number;
  credits: number;
  status: string;
  pixQrCode: string | null;
  pixExpiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: payment.id,
    userId: payment.userId,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    method: payment.method,
    amountCents: payment.amountCents,
    credits: payment.credits,
    status: payment.status,
    pixQrCode: payment.pixQrCode,
    expiresAt: isoDate(payment.pixExpiresAt),
    paidAt: isoDate(payment.paidAt),
    createdAt: payment.createdAt.toISOString(),
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
