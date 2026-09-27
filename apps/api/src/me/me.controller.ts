import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';

import { MeDTO } from '@big-eye/contracts';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

import { MeService } from './me.service.js';

class MeResponseDto extends createZodDto(MeDTO) {}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  @ZodSerializerDto(MeResponseDto)
  getMe(@CurrentUser() user: ApiUser) {
    return this.meService.getMe(user.id);
  }
}
