import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AthenasStatusResponseDTOType } from '@big-eye/contracts';

import { AthenasStatusService } from './athenas-status.service.js';

@ApiTags('services')
@ApiBearerAuth()
@Controller(['athenas', 'services'])
export class AthenasStatusController {
  constructor(@Inject(AthenasStatusService) private readonly statusService: AthenasStatusService) {}

  @Get('status')
  @ApiOperation({ summary: 'Consulta o status operacional dos serviços da Big Eye.' })
  getStatus(): Promise<AthenasStatusResponseDTOType> {
    return this.statusService.getStatus();
  }
}
