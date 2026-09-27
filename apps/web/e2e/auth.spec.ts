import { expect, test } from '@playwright/test';

const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
);
const hasTestUser = Boolean(process.env.SUPABASE_TEST_EMAIL && process.env.SUPABASE_TEST_PASSWORD);

test('visitante é redirecionado para o login', async ({ page }) => {
  test.skip(!hasSupabaseConfig, 'Configure as variáveis públicas do Supabase para o smoke E2E.');

  await page.goto('/');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/u);
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
});

test('usuário autenticado chega ao dashboard', async ({ page }) => {
  test.skip(
    !hasSupabaseConfig || !hasTestUser,
    'Configure Supabase e SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD para o smoke E2E.',
  );

  await page.goto('/');
  await page.getByLabel('Email').fill(process.env.SUPABASE_TEST_EMAIL ?? '');
  await page.getByLabel('Senha').fill(process.env.SUPABASE_TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/u);
});
