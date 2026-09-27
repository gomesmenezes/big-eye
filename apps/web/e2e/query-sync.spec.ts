import { expect, test } from '@playwright/test';

import { hasE2EConfig, loginAsTestUser, readBalance } from './helpers';

test('consulta síncrona mostra o resultado e debita um crédito', async ({ page }) => {
  test.skip(!hasE2EConfig, 'Configure Supabase e o usuário de teste para o E2E da consulta síncrona.');

  await loginAsTestUser(page);
  const balanceBefore = await readBalance(page);

  await page.goto('/consulta/cpf-basico');
  await page.getByLabel('CPF').fill('12345678901');
  await page.getByRole('button', { name: 'Consultar agora' }).click();

  await expect(page.getByRole('heading', { name: 'Consulta concluída' })).toBeVisible();
  await expect(page.getByText('Pessoa 8901')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByTestId('balance')).toHaveText(String(balanceBefore - 1));
});
