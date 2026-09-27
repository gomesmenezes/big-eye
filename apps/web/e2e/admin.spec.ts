import { expect, test, type Page, type Route } from '@playwright/test';

const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
);
const hasAdminUser = Boolean(process.env.SUPABASE_ADMIN_EMAIL && process.env.SUPABASE_ADMIN_PASSWORD);
const hasRegularUser = Boolean(process.env.SUPABASE_TEST_EMAIL && process.env.SUPABASE_TEST_PASSWORD);

const userId = '00000000-0000-0000-0000-000000000001';
const packageId = '00000000-0000-0000-0000-000000000002';

test.describe('backoffice admin', () => {
  test('usuário não-admin é devolvido ao dashboard', async ({ page }) => {
    test.skip(!hasSupabaseConfig || !hasRegularUser, 'Configure um usuário regular para o E2E de autorização.');

    await signIn(page, process.env.SUPABASE_TEST_EMAIL ?? '', process.env.SUPABASE_TEST_PASSWORD ?? '');
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/dashboard(?:\/|$)/u);
    await expect(page.getByRole('heading', { name: /olá, usuário e2e/i })).toBeVisible();
  });

  test('admin ajusta o saldo e vê o lançamento no extrato', async ({ page }) => {
    test.skip(!hasSupabaseConfig || !hasAdminUser, 'Configure um usuário admin para o E2E do backoffice.');

    await signIn(page, process.env.SUPABASE_ADMIN_EMAIL ?? '', process.env.SUPABASE_ADMIN_PASSWORD ?? '');
    const detail: UserFixture = {
      id: userId,
      email: 'cliente@example.com',
      name: 'Cliente de teste',
      role: 'user',
      status: 'active',
      balance: 4,
      transactions: [],
    };

    await page.route('**/admin/users**', async (route) => {
      await fulfillAdminUsers(route, detail);
    });

    await page.goto('/admin/usuarios');
    await page.getByRole('button', { name: 'Abrir' }).click();
    await page.getByLabel('Créditos (+/-)').fill('5');
    await page.getByLabel('Motivo').fill('Compensação de teste');
    await page.getByRole('button', { name: 'Ajustar saldo' }).click();

    await expect(page.getByRole('status')).toContainText('Ajuste registrado');
    await expect(page.getByText('Ajuste administrativo: Compensação de teste')).toBeVisible();

  });

  test('admin edita um pacote e vê o novo preço', async ({ page }) => {
    test.skip(!hasSupabaseConfig || !hasAdminUser, 'Configure um usuário admin para o E2E do backoffice.');

    await signIn(page, process.env.SUPABASE_ADMIN_EMAIL ?? '', process.env.SUPABASE_ADMIN_PASSWORD ?? '');
    let creditPackage = {
      id: packageId,
      slug: 'pacote-teste',
      credits: 10,
      priceCents: 1000,
      currency: 'BRL',
      active: true,
      sort: 1,
    };

    await page.route('**/admin/packages**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { priceCents?: number };
        creditPackage = { ...creditPackage, priceCents: body.priceCents ?? creditPackage.priceCents };
      }

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(route.request().method() === 'GET' ? [creditPackage] : creditPackage),
      });
    });

    await page.goto('/admin/pacotes');
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Preço (centavos)').fill('2500');
    await page.getByRole('button', { name: 'Salvar pacote' }).click();

    await expect(page.getByRole('status')).toContainText('Pacote atualizado');
    await expect(page.getByText('R$ 25,00')).toBeVisible();
  });
});

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/u);
}

type UserFixture = {
  id: string;
  email: string;
  name: string;
  role: 'user';
  status: 'active' | 'suspended';
  balance: number;
  transactions: Array<Record<string, unknown>>;
};

async function fulfillAdminUsers(route: Route, detail: UserFixture): Promise<void> {
  const method = route.request().method();

  if (method === 'PATCH') {
    const body = route.request().postDataJSON() as { amount?: number; reason?: string };
    const amount = body.amount ?? 0;
    detail.balance += amount;
    detail.transactions = [{
      id: '00000000-0000-0000-0000-000000000003',
      type: 'admin_adjust',
      amount,
      balanceAfter: detail.balance,
      refType: 'admin',
      refId: '00000000-0000-0000-0000-000000000004',
      description: `Ajuste administrativo: ${body.reason ?? ''}`,
      createdAt: new Date().toISOString(),
    }];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(detail) });
    return;
  }

  const isDetail = route.request().url().endsWith(`/admin/users/${userId}`);
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(isDetail ? detail : [detail]) });
}
