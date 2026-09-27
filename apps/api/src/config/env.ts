import 'dotenv/config';

import { z } from 'zod';

const httpUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback);
}, 'Expected HTTPS, or HTTP on a loopback address.');

const databaseUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'postgres:' || protocol === 'postgresql:';
}, 'Expected a PostgreSQL connection URL.');

const redisUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'redis:' || protocol === 'rediss:';
}, 'Expected a Redis connection URL.');

const environmentSchema = z.object({
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  REDIS_URL: redisUrl,
  SUPABASE_URL: httpUrl,
  SUPABASE_JWKS_URL: httpUrl,
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  PAYMENT_PROVIDER: z.enum(['fake', 'mercado-pago', 'pagarme']),
  PROVIDER_MODE: z.enum(['fake', 'upstream']),
  WEB_ORIGIN: z.string().trim().min(1),
  API_PORT: z.coerce.number().int().min(1).max(65_535),
  QUERY_TIMEOUT_MS: z.coerce.number().int().positive(),
  RESULT_TTL_SECONDS: z.coerce.number().int().positive(),
});

export type Environment = z.infer<typeof environmentSchema> & {
  WEB_ORIGINS: string[];
};

function parseOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      const parsed = new URL(origin);
      const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      const isAllowedProtocol = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopback);

      if (!isAllowedProtocol || parsed.origin !== origin.replace(/\/$/, '')) {
        throw new Error('WEB_ORIGIN entries must be HTTPS origins, or HTTP loopback origins, without paths.');
      }

      return parsed.origin;
    });

  if (origins.length === 0) {
    throw new Error('WEB_ORIGIN must contain at least one HTTPS or HTTP loopback origin.');
  }

  return [...new Set(origins)];
}

export function parseEnvironment(values: NodeJS.ProcessEnv): Environment {
  const parsed = environmentSchema.safeParse(values);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid API environment configuration: ${details}`);
  }

  try {
    return {
      ...parsed.data,
      WEB_ORIGINS: parseOrigins(parsed.data.WEB_ORIGIN),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid origin';
    throw new Error(`Invalid API environment configuration: WEB_ORIGIN: ${message}`);
  }
}

export const env = parseEnvironment(process.env);
