import type { ErrorCode } from '@big-eye/contracts';

export type ProviderRequest = {
  module: string;
  input: Record<string, unknown>;
};

export type ProviderResult =
  | { kind: 'result'; data: unknown }
  | { kind: 'accepted'; requestId: string };

export interface ProviderClient {
  execute(request: ProviderRequest): Promise<ProviderResult>;
  poll(requestId: string): Promise<ProviderResult>;
}

export type ProviderErrorCode = Extract<ErrorCode, 'PROVIDER_UNAVAILABLE' | 'QUERY_FAILED'>;

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message = 'O provedor não está disponível.') {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}
