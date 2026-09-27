import 'dotenv/config';

import { Worker } from 'bullmq';

import { ReconcileService } from '@big-eye/core/queries/reconcile.service';
import {
  BULLMQ_QUEUE_NAMES,
  QUEUE_NAMES,
  closeQueues,
  reconciliationQueue,
} from '@big-eye/core/queues/queues';
import { redis } from '@big-eye/core/redis';

import { createWorkerDependencies } from './processors/context.js';
import { createQueryPollProcessor } from './processors/query-poll.processor.js';
import { createQueryRunProcessor } from './processors/query-run.processor.js';

async function bootstrap(): Promise<void> {
  const dependencies = createWorkerDependencies();
  const runWorker = new Worker(
    BULLMQ_QUEUE_NAMES.queryRun,
    createQueryRunProcessor(dependencies),
    { connection: redis },
  );
  const pollWorker = new Worker(
    BULLMQ_QUEUE_NAMES.queryPoll,
    createQueryPollProcessor(dependencies),
    { connection: redis },
  );
  const reconcileService = new ReconcileService(
    dependencies.prisma,
    dependencies.credits,
    dependencies.eventsBus,
    dependencies.now,
  );
  const reconcileWorker = new Worker(
    QUEUE_NAMES.reconcile,
    async (job) => {
      await reconcileService.reconcileStuckQueries(job.data.olderThanMs);
    },
    { connection: redis },
  );

  for (const worker of [runWorker, pollWorker, reconcileWorker]) {
    worker.on('error', (error) => {
      console.error('Big Eye worker error', error);
    });
  }

  await reconciliationQueue.add(
    'reconcile',
    {},
    {
      jobId: 'reconcile:singleton',
      repeat: { every: 60_000 },
    },
  );

  const shutdown = async (): Promise<void> => {
    await Promise.all([runWorker.close(), pollWorker.close(), reconcileWorker.close()]);
    await closeQueues();
    await dependencies.prisma.$disconnect();
  };

  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}

void bootstrap().catch((error: unknown) => {
  console.error('Não foi possível iniciar o worker Big Eye.', error);
  process.exitCode = 1;
});
