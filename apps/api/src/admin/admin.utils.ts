import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

import { Prisma } from '@big-eye/core/db/prisma-client';

export const INVALID_INPUT = 'INVALID_INPUT' as const;

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export function parseLimit(value: unknown, defaultValue = 20): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException({ code: INVALID_INPUT });
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException({ code: INVALID_INPUT });
  }

  return limit;
}

export function parseOptionalDate(value: unknown): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException({ code: INVALID_INPUT });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({ code: INVALID_INPUT });
  }

  return date;
}

export function parseRequiredDate(value: unknown, fallback: Date): Date {
  return parseOptionalDate(value) ?? fallback;
}

export function parseCursor(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({ code: INVALID_INPUT });
  }

  return parsed.data;
}

export function parseOptionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException({ code: INVALID_INPUT });
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BadRequestException({ code: INVALID_INPUT });
  }

  return normalized || undefined;
}

export function parseBooleanQuery(value: unknown, defaultValue = false): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new BadRequestException({ code: INVALID_INPUT });
}

export function cursorPage<T extends { id: string }>(items: T[], limit: number): CursorPage<T> {
  const hasNextPage = items.length > limit;
  const pageItems = hasNextPage ? items.slice(0, limit) : items;

  return {
    items: pageItems,
    nextCursor: hasNextPage ? pageItems.at(-1)?.id ?? null : null,
  };
}

export function jsonPayload(payload: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    adminUserId: string;
    targetUserId?: string;
    action: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      targetUserId: input.targetUserId,
      action: input.action,
      payload: jsonPayload(input.payload),
    },
  });
}

export function isoDate(date: Date | null | undefined): string | null {
  return date?.toISOString() ?? null;
}
