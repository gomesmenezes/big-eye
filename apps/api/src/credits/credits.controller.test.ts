import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ERROR_CODES } from '@big-eye/contracts';
import { CreditsService } from '@big-eye/core/credits/credits.service';

import type { ApiUser } from '../auth/auth.types.js';

import { CreditsController } from './credits.controller.js';

const user: ApiUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.test',
  role: 'user',
  status: 'active',
};

function createController() {
  const creditsService = {
    listTransactions: vi.fn(),
  } as unknown as CreditsService;

  return {
    controller: new CreditsController(creditsService),
    listTransactions: vi.mocked(creditsService.listTransactions),
  };
}

describe('CreditsController', () => {
  it.each([
    ['not-a-number', undefined],
    ['0', undefined],
    ['101', undefined],
  ])('retorna 400 para limit inválido (%s)', async (limit, cursor) => {
    const { controller, listTransactions } = createController();

    await expect(controller.transactions(user, limit, cursor)).rejects.toMatchObject(
      new BadRequestException({ code: ERROR_CODES.INVALID_INPUT }),
    );
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it('retorna 400 para cursor que não é UUID', async () => {
    const { controller, listTransactions } = createController();

    await expect(controller.transactions(user, undefined, 'not-a-uuid')).rejects.toMatchObject(
      new BadRequestException({ code: ERROR_CODES.INVALID_INPUT }),
    );
    expect(listTransactions).not.toHaveBeenCalled();
  });
});
