import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { MeDTO, type MeDTOType } from '@big-eye/contracts';
import type { PrismaClient } from '@big-eye/core/db/prisma-client';

import type { ApiUser } from '../auth/auth.types.js';
import { PRISMA } from '../db/database.module.js';

@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getMe(user: ApiUser): Promise<MeDTOType> {
    const select = {
      id: true,
      email: true,
      name: true,
      role: true,
      wallet: { select: { balance: true } },
    } as const;

    const profile =
      user.role === null || user.status === null
        ? user.email
          ? await this.prisma.profile.upsert({
              where: { id: user.id },
              create: {
                id: user.id,
                email: user.email,
                wallet: { create: {} },
              },
              update: {},
              select,
            })
          : null
        : await this.prisma.profile.findUnique({
            where: { id: user.id },
            select,
          });

    if (!profile) {
      this.logger.warn('Authenticated account has no profile row and cannot be provisioned.');
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
