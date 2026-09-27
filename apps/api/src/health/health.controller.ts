import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { PrismaClient } from '@big-eye/core/db/prisma-client';

import { Public } from '../auth/public.decorator.js';
import { PRISMA } from '../db/database.module.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Verifica se a API está ativa.' })
  health() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Verifica se a API pode acessar o banco de dados.' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' as const };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
