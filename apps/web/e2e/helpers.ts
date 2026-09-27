import { expect, type Page } from '@playwright/test';

export const hasE2EConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
  process.env.SUPABASE_TEST_EMAIL &&
  process.env.SUPABASE_TEST_PASSWORD,
);

export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.SUPABASE_TEST_EMAIL ?? '');
  await page.getByLabel('Senha').fill(process.env.SUPABASE_TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/u);
}

export async function readBalance(page: Page): Promise<number> {
  await expect(page.getByTestId('balance')).toBeVisible();
  return Number(await page.getByTestId('balance').innerText());
}
