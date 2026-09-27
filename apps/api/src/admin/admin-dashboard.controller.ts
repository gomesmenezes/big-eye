import { BadRequestException, Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { Prisma, PrismaClient } from '@big-eye/core/db/prisma-client';

import { AdminGuard } from '../auth/roles.guard.js';
import { PRISMA } from '../db/database.module.js';

import { parseOptionalDate } from './admin.utils.js';

const DEFAULT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

@ApiTags('admin/dashboard')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminDashboardController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get('dashboard')
  async dashboard(
    @Query('from') fromValue: string | undefined,
    @Query('to') toValue: string | undefined,
  ) {
    const now = new Date();
    const from = parseOptionalDate(fromValue) ?? new Date(now.getTime() - DEFAULT_PERIOD_MS);
    const to = parseOptionalDate(toValue) ?? now;

    if (from > to) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    const dateRange = { gte: from, lte: to };
    const queryWhere: Prisma.QueryWhereInput = { createdAt: dateRange };
    const transactionWhere: Prisma.CreditTransactionWhereInput = { createdAt: dateRange };

    const [newUsers, purchased, consumed, totalQueries, failedQueries, byModule] =
      await Promise.all([
        this.prisma.profile.count({ where: { createdAt: dateRange } }),
        this.prisma.creditTransaction.aggregate({
          where: { ...transactionWhere, type: 'purchase' },
          _sum: { amount: true },
        }),
        this.prisma.creditTransaction.aggregate({
          where: { ...transactionWhere, type: 'consume' },
          _sum: { amount: true },
        }),
        this.prisma.query.count({ where: queryWhere }),
        this.prisma.query.count({
          where: { ...queryWhere, status: { in: ['failed', 'refunded'] } },
        }),
        this.prisma.query.groupBy({
          by: ['moduleSlug'],
          where: queryWhere,
          _count: { _all: true },
          orderBy: { _count: { moduleSlug: 'desc' } },
        }),
      ]);

    const total = totalQueries;
    const failureRate = total === 0 ? 0 : Number((failedQueries / total).toFixed(4));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      newUsers,
      creditsSold: purchased._sum.amount ?? 0,
      creditsConsumed: Math.abs(consumed._sum.amount ?? 0),
      queriesByModule: byModule.map((row) => ({
        moduleSlug: row.moduleSlug,
        count: row._count._all,
      })),
      totalQueries: total,
      failedQueries,
      failureRate,
    };
  }
}
