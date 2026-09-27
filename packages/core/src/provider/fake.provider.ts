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
};

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
  return createHash('sha256')
    .update(`${request.module}:${JSON.stringify(stableValue(request.input))}`)
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
  const cpf = readCpf(request);

  switch (request.module) {
    case 'cpf-basico':
      return {
        nome: `Pessoa ${cpf.slice(-4)}`,
        cpf,
        nascimento: '1990-01-01',
        situacao: 'ATIVA',
      };
    case 'dossie-360':
      return {
        resumo: `Consulta simulada para o CPF final ${cpf.slice(-2)}.`,
        fontes: ['fake-provider'],
      };
    default:
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Módulo indisponível no provedor.');
  }
}

/**
 * Deterministic provider used by local development and the phase-one tests.
 * A CPF ending in zero exercises the asynchronous provider contract.
 */
export class FakeProvider implements ProviderClient {
  private readonly pending = new Map<string, PendingRequest>();

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    const contract = getModule(request.module);

    if (!contract?.implemented) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Módulo indisponível no provedor.');
    }

    const cpf = readCpf(request);
    const requestId = `fake-${requestFingerprint(request)}`;

    if (contract.mode === 'async' && cpf.endsWith('0')) {
      this.pending.set(requestId, { request });
      return { kind: 'accepted', requestId };
    }

    return { kind: 'result', data: buildResult(request) };
  }

  async poll(requestId: string): Promise<ProviderResult> {
    const pending = this.pending.get(requestId);

    if (!pending) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Solicitação do provedor não encontrada.');
    }

    this.pending.delete(requestId);
    return { kind: 'result', data: buildResult(pending.request) };
  }
}
