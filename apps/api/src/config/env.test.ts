import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public',
  DIRECT_URL: 'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_JWKS_URL: 'https://example.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  PAYMENT_PROVIDER: 'fake',
  FAKE_PAYMENT_SECRET: 'test-fake-payment-secret',
  PROVIDER_MODE: 'fake',
  WEB_ORIGIN: 'http://localhost:3000,https://app.example.com',
  API_PORT: '3001',
  QUERY_TIMEOUT_MS: '15000',
  RESULT_TTL_SECONDS: '1800',
};

describe('API environment configuration', () => {
  it('validates required settings and normalizes the CORS allowlist', () => {
    const config = parseEnvironment(validEnvironment);

    expect(config.API_PORT).toBe(3001);
    expect(config.WEB_ORIGINS).toEqual(['http://localhost:3000', 'https://app.example.com']);
  });

  it('fails clearly on missing values and unsupported connection schemes', () => {
    expect(() => parseEnvironment({})).toThrow(/Invalid API environment configuration/);
    expect(() => parseEnvironment({ ...validEnvironment, REDIS_URL: 'https://cache.example.com' })).toThrow(
      /REDIS_URL: Expected a Redis connection URL/,
    );
    expect(() => parseEnvironment({ ...validEnvironment, WEB_ORIGIN: 'http://attacker.example' })).toThrow(
      /WEB_ORIGIN: WEB_ORIGIN entries must be HTTPS origins/,
    );
  });
});
