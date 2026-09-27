import { expect, test } from '@playwright/test';

import { hasE2EConfig, loginAsTestUser, readBalance } from './helpers';

test('consulta assíncrona acompanha o processamento via SSE e debita um crédito', async ({ page }) => {
  test.skip(!hasE2EConfig, 'Configure Supabase e o usuário de teste para o E2E da consulta assíncrona.');

  await loginAsTestUser(page);
  const balanceBefore = await readBalance(page);

  await page.goto('/consulta/dossie-360');
  await page.getByLabel('CPF').fill('12345678900');
  await page.getByRole('button', { name: 'Consultar agora' }).click();
  await expect(page.getByText('Acompanhando o processamento em tempo real...')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consulta concluída' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('fake-provider')).toBeVisible();

  await page.goto('/dashboard');
  await expect(page.getByTestId('balance')).toHaveText(String(balanceBefore - 1));
});
