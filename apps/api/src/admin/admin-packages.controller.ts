import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { Prisma, PrismaClient } from '@big-eye/core/db/prisma-client';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { PRISMA } from '../db/database.module.js';

import { parseLimit, writeAudit } from './admin.utils.js';

const packageFields = {
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(1).max(100),
  credits: z.number().int().min(1),
  priceCents: z.number().int().min(0),
  currency: z.literal('BRL').default('BRL'),
  active: z.boolean().default(true),
  sort: z.number().int().default(0),
};

const createPackageBody = z.object(packageFields);
const updatePackageBody = z
  .object({
    slug: packageFields.slug.optional(),
    credits: packageFields.credits.optional(),
    priceCents: packageFields.priceCents.optional(),
    currency: z.literal('BRL').optional(),
    active: z.boolean().optional(),
    sort: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

@ApiTags('admin/packages')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/packages')
export class AdminPackagesController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get()
  async list(
    @Query('includeInactive') includeInactive: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ) {
    const limit = parseLimit(rawLimit);
    const activeOnly = includeInactive !== 'true';
    const baseWhere: Prisma.CreditPackageWhereInput = activeOnly ? { active: true } : {};
    let where: Prisma.CreditPackageWhereInput = baseWhere;

    if (cursor) {
      const cursorRow = await this.prisma.creditPackage.findUnique({
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

    const packages = await this.prisma.creditPackage.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: packageSelect,
    });
    const hasNext = packages.length > limit;
    const items = packages.slice(0, limit).map(toPackageView);

    return {
      items,
      nextCursor: hasNext ? items.at(-1)?.id ?? null : null,
    };
  }

  @Post()
  async create(@CurrentUser() admin: ApiUser, @Body() body: unknown) {
    const parsed = createPackageBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    try {
      const creditPackage = await this.prisma.$transaction(async (tx) => {
        const created = await tx.creditPackage.create({
          data: parsed.data,
          select: packageSelect,
        });
        await writeAudit(tx, {
          adminUserId: admin.id,
          action: 'package.create',
          payload: { packageId: created.id, slug: created.slug },
        });
        return created;
      });

      return toPackageView(creditPackage);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException({ code: 'PACKAGE_ALREADY_EXISTS' });
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @CurrentUser() admin: ApiUser,
    @Param('id', new ParseUUIDPipe()) packageId: string,
    @Body() body: unknown,
  ) {
    const parsed = updatePackageBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_INPUT' });
    }

    try {
      const creditPackage = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.creditPackage.findUnique({
          where: { id: packageId },
          select: { id: true },
        });
        if (!existing) {
          throw new Error('PACKAGE_NOT_FOUND');
        }

        const updated = await tx.creditPackage.update({
          where: { id: packageId },
          data: parsed.data,
          select: packageSelect,
        });
        await writeAudit(tx, {
          adminUserId: admin.id,
          action: 'package.update',
          payload: { packageId, changes: parsed.data },
        });
        return updated;
      });

      return toPackageView(creditPackage);
    } catch (error) {
      if (error instanceof Error && error.message === 'PACKAGE_NOT_FOUND') {
        throw new NotFoundException();
      }
      if (isUniqueConstraintError(error)) {
        throw new ConflictException({ code: 'PACKAGE_ALREADY_EXISTS' });
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(
    @CurrentUser() admin: ApiUser,
    @Param('id', new ParseUUIDPipe()) packageId: string,
  ) {
    try {
      const creditPackage = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.creditPackage.findUnique({
          where: { id: packageId },
          select: { id: true },
        });
        if (!existing) {
          throw new Error('PACKAGE_NOT_FOUND');
        }

        const updated = await tx.creditPackage.update({
          where: { id: packageId },
          data: { active: false },
          select: packageSelect,
        });
        await writeAudit(tx, {
          adminUserId: admin.id,
          action: 'package.delete',
          payload: { packageId },
        });
        return updated;
      });

      return toPackageView(creditPackage);
    } catch (error) {
      if (error instanceof Error && error.message === 'PACKAGE_NOT_FOUND') {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}

const packageSelect = {
  id: true,
  slug: true,
  credits: true,
  priceCents: true,
  currency: true,
  active: true,
  sort: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPackageView(creditPackage: {
  id: string;
  slug: string;
  credits: number;
  priceCents: number;
  currency: string;
  active: boolean;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...creditPackage,
    createdAt: creditPackage.createdAt.toISOString(),
    updatedAt: creditPackage.updatedAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
