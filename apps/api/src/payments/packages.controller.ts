import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';

import { PackageDTO } from '@big-eye/contracts';
import { PaymentsService } from '@big-eye/core/payments';

class PackagesResponseDto extends createZodDto(z.array(PackageDTO)) {}

@ApiTags('packages')
@ApiBearerAuth()
@Controller('packages')
export class PackagesController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOkResponse({ type: PackagesResponseDto })
  @ZodSerializerDto(PackagesResponseDto)
  async list() {
    const packages = await this.paymentsService.listActivePackages();
    return packages.map((creditPackage) => PackageDTO.parse(creditPackage));
  }
}
