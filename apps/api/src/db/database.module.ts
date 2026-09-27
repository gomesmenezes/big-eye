import { Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';

import { prisma } from '@big-eye/core/db/prisma';
import type { PrismaClient } from '@big-eye/core/db/prisma-client';


export const PRISMA = Symbol('PRISMA');

@Injectable()
class PrismaLifecycle implements OnModuleDestroy {
  constructor(@Inject(PRISMA) private readonly client: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

@Module({
  providers: [{ provide: PRISMA, useValue: prisma }, PrismaLifecycle],
  exports: [PRISMA],
})
export class DatabaseModule {}
