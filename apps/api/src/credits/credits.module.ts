import { Module } from '@nestjs/common';

import { CreditsService } from '@big-eye/core/credits/credits.service';
import type { PrismaClient } from '@big-eye/core/db/prisma-client';

import { DatabaseModule, PRISMA } from '../db/database.module.js';

import { CreditsController } from './credits.controller.js';
import { CREDITS_SERVICE } from './credits.tokens.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CreditsController],
  providers: [
    {
      provide: CreditsService,
      inject: [PRISMA],
      useFactory: (client: PrismaClient) => new CreditsService(client),
    },
    { provide: CREDITS_SERVICE, useExisting: CreditsService },
  ],
  exports: [CreditsService, CREDITS_SERVICE],
})
export class CreditsModule {}
