import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';

import {
  InvalidPaymentEventError,
  InvalidPaymentSignatureError,
  PaymentsService,
} from '@big-eye/core/payments';

import { Public } from '../auth/public.decorator.js';
import { env } from '../config/env.js';

type RawBodyRequest = {
  rawBody?: Buffer;
  headers: Record<string, string | string[] | undefined>;
};

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Post('payments/:provider')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handle(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    if (provider !== env.PAYMENT_PROVIDER) {
      throw new BadRequestException('Unsupported payment provider.');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Raw webhook body is required.');
    }

    const normalizedHeaders = normalizeHeaders(headers);

    try {
      await this.paymentsService.handleWebhook(request.rawBody, normalizedHeaders);
      return { received: true };
    } catch (error) {
      if (error instanceof InvalidPaymentSignatureError) {
        throw new UnauthorizedException();
      }

      if (error instanceof InvalidPaymentEventError) {
        throw new BadRequestException('Invalid payment webhook.');
      }

      throw error;
    }
  }
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) => {
      if (typeof value === 'string') {
        return [[key, value]];
      }

      if (Array.isArray(value) && value[0]) {
        return [[key, value[0]]];
      }

      return [];
    }),
  );
}
