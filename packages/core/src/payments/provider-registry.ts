import { FakePaymentProvider } from './fake.provider.js';
import type { PaymentProvider } from './payment-provider.js';

const fakeProviders = new Map<string, FakePaymentProvider>();

export function getPaymentProvider(providerName = process.env.PAYMENT_PROVIDER ?? 'fake'): PaymentProvider {
  if (providerName === 'fake') {
    const secret = process.env.FAKE_PAYMENT_SECRET ?? 'fake-payment-secret';
    const existing = fakeProviders.get(secret);

    if (existing) {
      return existing;
    }

    const provider = new FakePaymentProvider(secret);
    fakeProviders.set(secret, provider);
    return provider;
  }

  throw new Error(`Payment provider "${providerName}" is not configured.`);
}

export function resetPaymentProviderRegistry(): void {
  fakeProviders.clear();
}
