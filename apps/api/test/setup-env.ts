import 'reflect-metadata';

const testEnvironmentDefaults: Record<string, string> = {
  DATABASE_URL: 'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public',
  DIRECT_URL: 'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_JWKS_URL: 'https://example.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  PAYMENT_PROVIDER: 'fake',
  FAKE_PAYMENT_SECRET: 'test-fake-payment-secret',
  PROVIDER_MODE: 'fake',
  WEB_ORIGIN: 'http://localhost:3000',
  API_PORT: '3001',
  QUERY_TIMEOUT_MS: '15000',
  RESULT_TTL_SECONDS: '1800',
};

for (const [key, value] of Object.entries(testEnvironmentDefaults)) {
  process.env[key] ??= value;
}
