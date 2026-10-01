import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { getAthenasStatus } from '@big-eye/core/provider/registry';

import { AdminGuard } from '../auth/roles.guard.js';

@ApiTags('admin/providers')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/providers')
export class AdminProviderController {
  @Get('athenas/status')
  @ApiOperation({ summary: 'Consulta o status operacional da API Athenas sem consumir créditos.' })
  async athenasStatus() {
    try {
      return await getAthenasStatus();
    } catch {
      throw new ServiceUnavailableException({ code: 'PROVIDER_UNAVAILABLE' });
    }
  }
}
