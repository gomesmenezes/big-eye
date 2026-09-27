import { PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const creditPackages = [
  { slug: 'creditos-10', credits: 10, priceCents: 990, sort: 1 },
  { slug: 'creditos-50', credits: 50, priceCents: 3_990, sort: 2 },
  { slug: 'creditos-100', credits: 100, priceCents: 6_990, sort: 3 },
] as const;

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
