import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { MeDTO, type MeDTOType } from '@big-eye/contracts';
import type { PrismaClient } from '@big-eye/core/db/prisma-client';

import { PRISMA } from '../db/database.module.js';

@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getMe(userId: string): Promise<MeDTOType> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        wallet: { select: { balance: true } },
      },
    });

    if (!profile) {
      this.logger.warn('Authenticated account has no profile row yet.');
      throw new NotFoundException();
    }

    return MeDTO.parse({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      balance: profile.wallet?.balance ?? 0,
    });
  }
}
