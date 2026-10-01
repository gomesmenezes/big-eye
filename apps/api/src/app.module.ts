import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { CreditsService } from '@big-eye/core/credits/credits.service';
import type { PrismaClient } from '@big-eye/core/db/prisma-client';
import { getProviderClient } from '@big-eye/core/provider/registry';
import { QueriesService } from '@big-eye/core/queries/queries.service';
import { queryEventsBus } from '@big-eye/core/query-events';
import { resultCache } from '@big-eye/core/result-cache';

import { AdminModule } from './admin/admin.module.js';
import { AthenasStatusModule } from './athenas/athenas-status.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { CreditsModule } from './credits/credits.module.js';
import { DatabaseModule, PRISMA } from './db/database.module.js';
import { HealthController } from './health/health.controller.js';
import { MeModule } from './me/me.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import {
  QueriesSseController,
  QUERY_EVENTS_BUS,
  RESULT_CACHE,
} from './queries/queries-sse.controller.js';
import { QueriesController } from './queries/queries.controller.js';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    AthenasStatusModule,
    DatabaseModule,
    CreditsModule,
    MeModule,
    PaymentsModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
  ],
  controllers: [HealthController, QueriesController, QueriesSseController],
  providers: [
    { provide: QUERY_EVENTS_BUS, useValue: queryEventsBus },
    { provide: RESULT_CACHE, useValue: resultCache },
    {
      provide: QueriesService,
      inject: [PRISMA, CreditsService, RESULT_CACHE],
      useFactory: (
        client: PrismaClient,
        creditsService: CreditsService,
        cache: typeof resultCache,
      ) => new QueriesService(client, creditsService, getProviderClient(), cache),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
