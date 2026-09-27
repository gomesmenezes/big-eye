import { Module } from '@nestjs/common';

import { getPaymentProvider, PaymentsService } from '@big-eye/core/payments';

import { CreditsModule } from '../credits/credits.module.js';
import { DatabaseModule, PRISMA } from '../db/database.module.js';

import { PackagesController } from './packages.controller.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsJobs } from './payments.jobs.js';
import { CREDITS_SERVICE, PAYMENT_PROVIDER } from './payments.tokens.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [DatabaseModule, CreditsModule],
  controllers: [PackagesController, PaymentsController, WebhooksController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () => getPaymentProvider(),
    },
    {
      provide: PaymentsService,
      useFactory: (prisma: ConstructorParameters<typeof PaymentsService>[0], provider: ConstructorParameters<typeof PaymentsService>[1], credits: ConstructorParameters<typeof PaymentsService>[2]) =>
        new PaymentsService(prisma, provider, credits),
      inject: [PRISMA, PAYMENT_PROVIDER, CREDITS_SERVICE],
    },
    PaymentsJobs,
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
