import { PrismaClient } from '@prisma/client';

const localDatabaseUrl =
  'postgresql://bigeye:bigeye@localhost:5432/bigeye?schema=public';
const databaseUrl =
  process.env.BIGEYE_TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  localDatabaseUrl;
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, '').split('/')[0];
const isLocalTestDatabase =
  ['localhost', '127.0.0.1', '::1'].includes(parsedDatabaseUrl.hostname) &&
  databaseName === 'bigeye';

if (!isLocalTestDatabase) {
  throw new Error(
    'O fixture auth só pode ser criado no banco local "bigeye".',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main(): Promise<void> {
  const existingAuthUsers = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('auth.users') IS NOT NULL AS exists
  `;

  if (existingAuthUsers[0]?.exists) {
    return;
  }

  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS auth');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY,
      email TEXT,
      raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
}

void main()
  .catch((error: unknown) => {
    console.error('Falha ao preparar o fixture local de auth.');
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
