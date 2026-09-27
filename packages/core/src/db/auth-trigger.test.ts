import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from './prisma-client.js';

const localDatabaseUrl =
  'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public';
const databaseUrl =
  process.env.BIGEYE_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  localDatabaseUrl;
const allowNonLocalDatabase =
  process.env.BIGEYE_ALLOW_NONLOCAL_TEST_DATABASE === 'true';
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, '').split('/')[0];
const isLocalTestDatabase =
  ['localhost', '127.0.0.1', '::1'].includes(parsedDatabaseUrl.hostname) &&
  databaseName === 'bigeye';

if (!isLocalTestDatabase && !allowNonLocalDatabase) {
  throw new Error(
    'O teste do trigger auth só pode usar o banco local "bigeye".',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

describe('trigger de criação de usuário', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('cria profile e wallet para um novo auth user', async ({ skip }) => {
    const triggerExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'on_auth_user_created'
          AND tgrelid = to_regclass('auth.users')
          AND NOT tgisinternal
      ) AS exists
    `;

    if (!triggerExists[0]?.exists) {
      skip('Execute db:test:prepare antes de aplicar as migrações.');
      return;
    }

    const userId = randomUUID();
    const email = `auth-trigger-${userId}@example.test`;

    try {
      await prisma.$executeRaw`
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES (
          ${userId}::uuid,
          ${email},
          ${JSON.stringify({ name: 'Teste de trigger' })}::jsonb
        )
      `;

      const [profile, wallet] = await Promise.all([
        prisma.profile.findUnique({ where: { id: userId } }),
        prisma.wallet.findUnique({ where: { userId } }),
      ]);

      expect(profile).toMatchObject({
        id: userId,
        email,
        name: 'Teste de trigger',
        role: 'user',
        status: 'active',
      });
      expect(wallet).toMatchObject({ userId, balance: 0 });
    } finally {
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.profile.deleteMany({ where: { id: userId } });
      await prisma.$executeRaw`
        DELETE FROM auth.users WHERE id = ${userId}::uuid
      `;
    }
  }, 15_000);
});
