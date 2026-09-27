import { FakeProvider } from './fake.provider.js';
import { ProviderError, type ProviderClient, type ProviderResult } from './provider.client.js';

class UnavailableProvider implements ProviderClient {
  async execute(): Promise<ProviderResult> {
    throw new ProviderError('PROVIDER_UNAVAILABLE');
  }

  async poll(): Promise<ProviderResult> {
    throw new ProviderError('PROVIDER_UNAVAILABLE');
  }
}

export function getProviderClient(): ProviderClient {
  switch (process.env.PROVIDER_MODE ?? 'fake') {
    case 'fake':
      return new FakeProvider();
    case 'upstream':
      // The upstream adapter is intentionally introduced after phase one.
      return new UnavailableProvider();
    default:
      throw new Error('PROVIDER_MODE inválido.');
  }
}
