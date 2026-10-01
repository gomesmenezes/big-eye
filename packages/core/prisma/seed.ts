import { PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const creditPackages = [
  { slug: 'teste-5', credits: 5, priceCents: 490, sort: 1 },
  { slug: 'popular-1000', credits: 1_000, priceCents: 3_990, sort: 2 },
  { slug: 'avancado-5000', credits: 5_000, priceCents: 9_990, sort: 3 },
  { slug: 'pro-20000', credits: 20_000, priceCents: 24_990, sort: 4 },
] as const;

const retiredCreditPackageSlugs = ['creditos-10', 'creditos-50', 'creditos-100'] as const;

async function main(): Promise<void> {
  for (const creditPackage of creditPackages) {
    await prisma.creditPackage.upsert({
      where: { slug: creditPackage.slug },
      create: {
        ...creditPackage,
        currency: 'BRL',
      },
      // Preserve prices and active state if an admin edited the package.
      update: {},
    });
  }

  await prisma.creditPackage.updateMany({
    where: { slug: { in: [...retiredCreditPackageSlugs] } },
    data: { active: false },
  });

  if (process.env.NODE_ENV !== 'production') {
    const adminId = '00000000-0000-4000-8000-000000000001';
    await prisma.profile.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        email: 'admin@big-eye.local',
        name: 'Admin de desenvolvimento',
        role: Role.admin,
      },
      update: {
        role: Role.admin,
        status: UserStatus.active,
      },
    });

    await prisma.wallet.upsert({
      where: { userId: adminId },
      create: { userId: adminId },
      update: {},
    });
  }
}

void main()
  .catch((error: unknown) => {
    console.error('Falha ao executar o seed do Big Eye.');
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
