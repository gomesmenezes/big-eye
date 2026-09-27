import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';
import { configureApiApp } from './app.setup.js';
import { AppLogger } from './common/logger.js';
import { env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(new AppLogger('BigEyeAPI'));
  await configureApiApp(app);
  app.enableShutdownHooks();
  await app.listen(env.API_PORT, '0.0.0.0');
}

void bootstrap();
