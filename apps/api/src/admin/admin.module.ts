import { Module } from '@nestjs/common';

import { retryInputCache } from '@big-eye/core/queries/input-retry-cache';
import { queryQueue } from '@big-eye/core/queues/queues';

import { AuthModule } from '../auth/auth.module.js';
import { CreditsModule } from '../credits/credits.module.js';
import { DatabaseModule } from '../db/database.module.js';

import { AdminDashboardController } from './admin-dashboard.controller.js';
import { AdminPackagesController } from './admin-packages.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { AdminProviderController } from './admin-provider.controller.js';
import {
  ADMIN_QUERY_QUEUE,
  ADMIN_RETRY_INPUT_CACHE,
  AdminQueriesController,
} from './admin-queries.controller.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  imports: [AuthModule, DatabaseModule, CreditsModule],
  controllers: [
    AdminUsersController,
    AdminQueriesController,
    AdminPaymentsController,
    AdminPackagesController,
    AdminDashboardController,
    AdminProviderController,
  ],
  providers: [
    { provide: ADMIN_QUERY_QUEUE, useValue: queryQueue },
    { provide: ADMIN_RETRY_INPUT_CACHE, useValue: retryInputCache },
  ],
})
export class AdminModule {}
