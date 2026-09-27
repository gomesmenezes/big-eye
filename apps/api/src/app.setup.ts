import helmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { env } from './config/env.js';

export async function configureApiApp(app: NestFastifyApplication): Promise<void> {
  await app.register(helmet);
  app.enableCors({
    origin: env.WEB_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  });

  const config = new DocumentBuilder()
    .setTitle('Big Eye API')
    .setDescription('API da plataforma Big Eye.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document), {
    jsonDocumentUrl: 'docs-json',
  });
}
