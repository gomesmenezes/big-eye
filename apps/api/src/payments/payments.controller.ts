import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaymentDTO } from '@big-eye/contracts';
import {
  PaymentNotFoundError,
  PaymentPackageNotFoundError,
  PaymentsService,
  type PaymentView,
} from '@big-eye/core/payments';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

const createPaymentBody = z.object({
  packageId: z.string().uuid(),
  method: z.enum(['pix', 'card']),
});

class CreatePaymentBodyDto extends createZodDto(createPaymentBody) {}
class PaymentResponseDto extends createZodDto(PaymentDTO) {}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ZodSerializerDto(PaymentResponseDto)
  async create(
    @CurrentUser() user: ApiUser,
    @Body() body: CreatePaymentBodyDto,
  ) {
    try {
      const payment = await this.paymentsService.createCheckout(user.id, body);
      return toPaymentResponse(payment);
    } catch (error) {
      if (error instanceof PaymentPackageNotFoundError) {
        throw new NotFoundException('Active credit package not found.');
      }
      throw error;
    }
  }

  @Get(':id')
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse()
  @ZodSerializerDto(PaymentResponseDto)
  async get(
    @CurrentUser() user: ApiUser,
    @Param('id', new ParseUUIDPipe()) paymentId: string,
  ) {
    try {
      return toPaymentResponse(await this.paymentsService.get(user.id, paymentId));
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        throw new NotFoundException('Payment not found.');
      }
      throw error;
    }
  }
}

function toPaymentResponse(payment: PaymentView) {
  return PaymentDTO.parse({
    id: payment.id,
    method: payment.method,
    amountCents: payment.amountCents,
    credits: payment.credits,
    status: payment.status,
    ...(payment.pixQrCode ? { pixQrCode: payment.pixQrCode } : {}),
    ...(payment.checkoutUrl ? { checkoutUrl: payment.checkoutUrl } : {}),
    ...(payment.expiresAt ? { expiresAt: payment.expiresAt.toISOString() } : {}),
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  });
}
