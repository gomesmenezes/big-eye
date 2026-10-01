import { createHash } from 'node:crypto';

import { getModule } from '@big-eye/contracts';

import {
  ProviderError,
  type ProviderClient,
  type ProviderRequest,
  type ProviderResult,
} from './provider.client.js';

type PendingRequest = {
  request: ProviderRequest;
  idempotencyKey?: string;
};

function idempotencyKey(request: ProviderRequest): string | undefined {
  const value = request.idempotencyKey?.trim();
  return value || undefined;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }

  return value;
}

function requestFingerprint(request: ProviderRequest): string {
  const key = idempotencyKey(request);
  const payload = key
    ? `${key}:${request.module}:${JSON.stringify(stableValue(request.input))}`
    : `${request.module}:${JSON.stringify(stableValue(request.input))}`;

  return createHash('sha256')
    .update(payload)
    .digest('hex')
    .slice(0, 24);
}

function readCpf(request: ProviderRequest): string {
  const cpf = request.input.cpf;

  if (typeof cpf !== 'string' || !/^\d{11}$/.test(cpf) || /^0{11}$/.test(cpf)) {
    throw new ProviderError('PROVIDER_UNAVAILABLE', 'O provedor não aceitou a consulta.');
  }

  return cpf;
}

function buildResult(request: ProviderRequest): unknown {
  switch (request.module) {
    case 'cpf-basico': {
      const cpf = readCpf(request);
      return {
        nome: `Pessoa ${cpf.slice(-4)}`,
        cpf,
        nascimento: '1990-01-01',
        situacao: 'ATIVA',
      };
    }
    case 'dossie-360': {
      const cpf = readCpf(request);
      return {
        resumo: `Consulta simulada para o CPF final ${cpf.slice(-2)}.`,
        fontes: ['fake-provider'],
      };
    }
    default:
      return {
        provider: 'fake-provider',
        module: request.module,
        input: request.input,
      };
  }
}

function asyncTriggerValue(request: ProviderRequest): string | undefined {
  return Object.values(request.input).find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

/**
 * Deterministic provider used by local development and the phase-one tests.
 * A CPF ending in zero exercises the asynchronous provider contract.
 */
export class FakeProvider implements ProviderClient {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pendingByIdempotencyKey = new Map<string, string>();
  private readonly completedByIdempotencyKey = new Map<string, ProviderResult>();

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    const contract = getModule(request.module);

    if (!contract?.implemented) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Chamada/Consulta indisponível no provedor.');
    }

    const stableKey = idempotencyKey(request);

    if (stableKey) {
      const completed = this.completedByIdempotencyKey.get(stableKey);
      if (completed) {
        return completed;
      }

      const existingRequestId = this.pendingByIdempotencyKey.get(stableKey);
      if (existingRequestId) {
        return { kind: 'accepted', requestId: existingRequestId };
      }
    }

    const requestId = `fake-${requestFingerprint(request)}`;
    const triggerValue = asyncTriggerValue(request);

    if (contract.mode === 'async' && triggerValue?.endsWith('0')) {
      this.pending.set(requestId, { request, idempotencyKey: stableKey });
      if (stableKey) {
        this.pendingByIdempotencyKey.set(stableKey, requestId);
      }
      return { kind: 'accepted', requestId };
    }

    const result: ProviderResult = { kind: 'result', data: buildResult(request) };
    if (stableKey) {
      this.completedByIdempotencyKey.set(stableKey, result);
    }
    return result;
  }

  async poll(requestId: string): Promise<ProviderResult> {
    const pending = this.pending.get(requestId);

    if (!pending) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Solicitação do provedor não encontrada.');
    }

    this.pending.delete(requestId);
    if (pending.idempotencyKey) {
      this.pendingByIdempotencyKey.delete(pending.idempotencyKey);
    }

    const result: ProviderResult = { kind: 'result', data: buildResult(pending.request) };
    if (pending.idempotencyKey) {
      this.completedByIdempotencyKey.set(pending.idempotencyKey, result);
    }
    return result;
  }
}
