import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CreditsService, InsufficientCreditsError } from '@big-eye/core/credits/credits.service';
import type { Prisma, PrismaClient } from '@big-eye/core/db/prisma-client';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { PRISMA } from '../db/database.module.js';

import {
  isoDate,
  parseCursor,
  parseLimit,
  parseOptionalText,
  writeAudit,
} from './admin.utils.js';

const walletBody = z.object({
  amount: z.number().int().refine((value) => value !== 0, 'O ajuste deve ser diferente de zero.'),
  reason: z.string().trim().min(1).max(500),
});

const statusBody = z.object({ status: z.enum(['active', 'suspended']) });

type ProfileSummary = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
  wallet: { balance: number } | null;
};

@ApiTags('admin/users')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CreditsService) private readonly credits: CreditsService,
  ) {}

  @Get()
  async list(
    @Query('q') query: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ) {
    const limit = parseLimit(rawLimit);
    const search = parseOptionalText(query, 200);
    const baseWhere: Prisma.ProfileWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    let where: Prisma.ProfileWhereInput = baseWhere;
    const parsedCursor = parseCursor(cursor);
    if (parsedCursor) {
      const cursorRow = await this.prisma.profile.findFirst({
        where: { AND: [baseWhere, { id: parsedCursor }] },
        select: { id: true, createdAt: true },
      });

      if (!cursorRow) {
        return { items: [], nextCursor: null };
      }

      where = {
        AND: [
          baseWhere,
          {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
            ],
          },
        ],
      };
    }

    const profiles = await this.prisma.profile.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        wallet: { select: { balance: true } },
      },
    });

    const hasNext = profiles.length > limit;
    const items = profiles.slice(0, limit).map(toProfileSummary);

    return {
      items,
      nextCursor: hasNext ? items.at(-1)?.id ?? null : null,
    };
  }

  @Get(':id')
  async get(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Query('limit') rawLimit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        wallet: { select: { balance: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException();
    }

    const limit = parseLimit(rawLimit);
    const transactions = await this.listTransactions(userId, limit, parseCursor(cursor));

    return {
      ...toProfileSummary(profile),
      transactions: transactions.items,
      transactionsNextCursor: transactions.nextCursor,
    };
  }

  @Patch(':id/wallet')
  async adjustWallet(
    @CurrentUser() admin: ApiUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() body: unknown,
  ) {
    const parsed = walletBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const target = await tx.profile.findUnique({
          where: { id: userId },
          select: { id: true },
        });

        if (!target) {
          throw new NotFoundException();
        }

        await this.credits.adjust(tx, {
          userId,
          adminId: admin.id,
          amount: parsed.data.amount,
          reason: parsed.data.reason,
        });
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof InsufficientCreditsError) {
        throw new BadRequestException({ code: 'INSUFFICIENT_CREDITS' });
      }

      if (error instanceof RangeError) {
        throw new BadRequestException({ code: 'INVALID_INPUT' });
      }

      throw error;
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });

    return { userId, balance: wallet?.balance ?? 0 };
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() admin: ApiUser,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() body: unknown,
  ) {
    const parsed = statusBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    const profile = await this.prisma.$transaction(async (tx) => {
      const target = await tx.profile.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!target) {
        throw new NotFoundException();
      }

      const updated = await tx.profile.update({
        where: { id: userId },
        data: { status: parsed.data.status },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          wallet: { select: { balance: true } },
        },
      });

      await writeAudit(tx, {
        adminUserId: admin.id,
        targetUserId: userId,
        action: 'user.status',
        payload: { status: parsed.data.status },
      });

      return updated;
    });

    return toProfileSummary(profile);
  }

  private async listTransactions(userId: string, limit: number, cursor?: string) {
    let where: Prisma.CreditTransactionWhereInput = { userId };

    const parsedCursor = parseCursor(cursor);
    if (parsedCursor) {
      const cursorRow = await this.prisma.creditTransaction.findFirst({
        where: { id: parsedCursor, userId },
        select: { id: true, createdAt: true },
      });

      if (!cursorRow) {
        return { items: [], nextCursor: null };
      }

      where = {
        userId,
        OR: [
          { createdAt: { lt: cursorRow.createdAt } },
          { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
        ],
      };
    }

    const rows = await this.prisma.creditTransaction.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        refType: true,
        refId: true,
        description: true,
        createdAt: true,
      },
    });

    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      ...row,
      createdAt: isoDate(row.createdAt),
    }));

    return {
      items,
      nextCursor: hasNext ? items.at(-1)?.id ?? null : null,
    };
  }
}

function toProfileSummary(profile: ProfileSummary) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    status: profile.status,
    balance: profile.wallet?.balance ?? 0,
    wallet: { balance: profile.wallet?.balance ?? 0 },
    createdAt: profile.createdAt.toISOString(),
  };
}
