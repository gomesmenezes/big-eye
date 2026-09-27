import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
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
  return Number.isInteger(parsed) ? parsed : Number.NaN;
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
      cursor,
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
