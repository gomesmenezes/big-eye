import { createHmac, randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { hasE2EConfig, loginAsTestUser, readBalance } from './helpers';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

test('compra Pix confirma via webhook fake e atualiza o saldo', async ({ page, request }) => {
  test.skip(!hasE2EConfig, 'Configure Supabase e o usuário de teste para o E2E de compra.');

  await loginAsTestUser(page);
  const balanceBefore = await readBalance(page);
  await page.goto('/creditos');

  const packageButton = page.locator('button').filter({ hasText: /créditos/u }).first();
  const packageCredits = Number((await packageButton.innerText()).match(/\d+/u)?.[0] ?? 0);
  await packageButton.click();
  await page.getByRole('radio', { name: /Pix/u }).check();
  await page.getByRole('button', { name: 'Continuar para pagamento' }).click();

  const pixCode = page.locator('code');
  await expect(pixCode).toBeVisible();
  const code = await pixCode.innerText();
  const providerPaymentId = code.match(/fake_payment_[0-9a-f-]+/u)?.[0];
  if (!providerPaymentId) {
    throw new Error('O QR Pix fake não trouxe o identificador do pagamento.');
  }

  const body = JSON.stringify({
    providerEventId: `e2e-${randomUUID()}`,
    providerPaymentId,
    status: 'paid',
  });
  const signature = createHmac('sha256', process.env.FAKE_PAYMENT_SECRET ?? 'fake-payment-secret')
    .update(body)
    .digest('hex');

  const webhook = await request.post(`${apiUrl}/webhooks/payments/fake`, {
    data: body,
    headers: {
      'content-type': 'application/json',
      'x-fake-signature': signature,
    },
  });
  expect(webhook.ok()).toBe(true);

  await expect(page.getByText('Pagamento confirmado')).toBeVisible({ timeout: 10_000 });
  await page.goto('/dashboard');
  await expect(page.getByTestId('balance')).toHaveText(String(balanceBefore + packageCredits));
});
