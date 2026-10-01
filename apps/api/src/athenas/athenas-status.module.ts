import { Module } from '@nestjs/common';

import { AthenasStatusController } from './athenas-status.controller.js';
import { AthenasStatusService } from './athenas-status.service.js';

@Module({
  controllers: [AthenasStatusController],
  providers: [AthenasStatusService],
})
export class AthenasStatusModule {}
