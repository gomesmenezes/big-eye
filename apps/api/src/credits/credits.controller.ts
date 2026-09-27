import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import {
  ERROR_CODES,
  TransactionDTO,
  type TransactionDTOType,
} from '@big-eye/contracts';
import { CreditsService } from '@big-eye/core/credits/credits.service';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new BadRequestException({ code: ERROR_CODES.INVALID_INPUT });
  }

  return parsed;
}

function parseCursor(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!z.string().uuid().safeParse(value).success) {
    throw new BadRequestException({ code: ERROR_CODES.INVALID_INPUT });
  }

  return value;
}

@ApiTags('credits')
@ApiBearerAuth()
@Controller('credits')
export class CreditsController {
  constructor(@Inject(CreditsService) private readonly creditsService: CreditsService) {}

  @Get('transactions')
  async transactions(
    @CurrentUser() user: ApiUser,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ): Promise<TransactionDTOType[]> {
    const transactions = await this.creditsService.listTransactions(user.id, {
      limit: parseLimit(limit),
      cursor: parseCursor(cursor),
    });

    return transactions.map((transaction) =>
      TransactionDTO.parse({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        refType: transaction.refType,
        refId: transaction.refId,
        description: transaction.description,
        createdAt: transaction.createdAt.toISOString(),
      }),
    );
  }
}
