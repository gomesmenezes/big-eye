import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PaymentsService } from '@big-eye/core/payments';

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
const EXPIRE_INTERVAL_MS = 60 * 1000;

@Injectable()
export class PaymentsJobs implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsJobs.name);
  private reconcileTimer?: NodeJS.Timeout;
  private expireTimer?: NodeJS.Timeout;
  private reconciliationRunning = false;
  private expirationRunning = false;

  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  onModuleInit(): void {
    this.reconcileTimer = setInterval(() => {
      void this.runReconciliation();
    }, RECONCILE_INTERVAL_MS);
    this.expireTimer = setInterval(() => {
      void this.runExpiration();
    }, EXPIRE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
    }
    if (this.expireTimer) {
      clearInterval(this.expireTimer);
    }
  }

  private async runReconciliation(): Promise<void> {
    if (this.reconciliationRunning) {
      return;
    }

    this.reconciliationRunning = true;

    try {
      await this.paymentsService.reconcilePending();
    } catch (error) {
      this.logger.error('Payment reconciliation failed.', error);
    } finally {
      this.reconciliationRunning = false;
    }
  }

  private async runExpiration(): Promise<void> {
    if (this.expirationRunning) {
      return;
    }

    this.expirationRunning = true;

    try {
      await this.paymentsService.expireStale();
    } catch (error) {
      this.logger.error('Payment expiration failed.', error);
    } finally {
      this.expirationRunning = false;
    }
  }
}
