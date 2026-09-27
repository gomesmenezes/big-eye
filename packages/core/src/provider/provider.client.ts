import type { ErrorCode } from '@big-eye/contracts';

export type ProviderRequest = {
  module: string;
  input: Record<string, unknown>;
  /**
   * Stable logical operation key. Adapters should forward it to an upstream
   * idempotency header or field when the provider supports one. Keeping this
   * optional preserves compatibility with adapters that do not have that
   * capability yet; the application cannot infer idempotency from the result
   * alone.
   */
  idempotencyKey?: string;
  /**
   * Adapters should stop network work when the API timeout expires. The
   * field is optional so existing fake and worker adapters remain compatible.
   */
  signal?: AbortSignal;
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
