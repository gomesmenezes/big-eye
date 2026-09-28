import { AthenasProvider, DEFAULT_ATHENAS_API_BASE_URL } from './athenas.provider.js';
import { FakeProvider } from './fake.provider.js';
import type { ProviderClient } from './provider.client.js';

export function getProviderClient(): ProviderClient {
  switch (process.env.PROVIDER_MODE ?? 'fake') {
    case 'fake':
      return new FakeProvider();
    case 'upstream': {
      const apiKey = process.env.ATHENAS_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('ATHENAS_API_KEY é obrigatória quando PROVIDER_MODE=upstream.');
      }

      return new AthenasProvider({
        apiKey,
        baseUrl: process.env.ATHENAS_API_BASE_URL ?? DEFAULT_ATHENAS_API_BASE_URL,
      });
    }
    default:
      throw new Error('PROVIDER_MODE inválido.');
  }
}
