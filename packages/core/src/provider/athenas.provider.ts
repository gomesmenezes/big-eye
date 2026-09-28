import type {
  ProviderClient,
  ProviderRequest,
  ProviderResult,
} from './provider.client.js';
import { ProviderError } from './provider.client.js';

export const DEFAULT_ATHENAS_API_BASE_URL = 'https://api.athenasbuscas.com/api/ext/v1';

const CPF_TIMEOUT_MS = 30_000;
const DOSSIER_TIMEOUT_MS = 60_000;

type AthenasRoute = {
  endpoint: string;
  timeoutMs: number;
};

type AthenasProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function routeFor(request: ProviderRequest): AthenasRoute {
  const cpf = request.input.cpf;

  if (typeof cpf !== 'string' || !/^\d{11}$/u.test(cpf)) {
    throw new ProviderError('QUERY_FAILED', 'A entrada da consulta não é válida.');
  }

  switch (request.module) {
    case 'cpf-basico':
      return { endpoint: `/cpf/${encodeURIComponent(cpf)}`, timeoutMs: CPF_TIMEOUT_MS };
    case 'dossie-360':
      return { endpoint: `/dossie-360/${encodeURIComponent(cpf)}`, timeoutMs: DOSSIER_TIMEOUT_MS };
    default:
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Módulo sem integração Athenas.');
  }
}

function getData(payload: Record<string, unknown>): Record<string, unknown> {
  return isRecord(payload.data) ? payload.data : payload;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function normalizeCpfResult(
  payload: Record<string, unknown>,
  requestedCpf: string,
): Record<string, unknown> {
  const data = getData(payload);
  if (payload.success === false || data.success === false) {
    throw new ProviderError('QUERY_FAILED', 'A consulta de CPF não foi concluída.');
  }

  const personal = isRecord(data.dadosPessoais)
    ? data.dadosPessoais
    : isRecord(data.pessoa)
      ? data.pessoa
      : data;
  const returnedCpf = firstString(data.cpf, personal.cpf, payload.cpf);

  if (returnedCpf && returnedCpf.replace(/\D/gu, '') !== requestedCpf) {
    throw new ProviderError('QUERY_FAILED', 'O provedor devolveu dados incompatíveis com a consulta.');
  }

  const name = firstString(personal.nome, personal.NOME, data.nome, data.NOME);
  if (!name) {
    throw new ProviderError('QUERY_FAILED', 'O provedor devolveu uma resposta inválida.');
  }

  const situationValue = personal.situacaoCadastral ?? personal.situacao ?? data.situacao;
  const situation =
    typeof situationValue === 'string'
      ? situationValue
      : isRecord(situationValue)
        ? firstString(situationValue.descricao, situationValue.status)
        : undefined;
  const birthDate = firstString(personal.dataNascimento, personal.nascimento, data.dataNascimento);

  return {
    ...payload,
    nome: name,
    cpf: requestedCpf,
    ...(birthDate ? { nascimento: birthDate } : {}),
    ...(situation ? { situacao: situation } : {}),
  };
}

function summarizeDossier(payload: Record<string, unknown>): string {
  const data = getData(payload);
  const summary = isRecord(data.summary) ? data.summary : undefined;
  const found = typeof summary?.found === 'number' && Number.isFinite(summary.found)
    ? summary.found
    : undefined;
  const empty = typeof summary?.empty === 'number' && Number.isFinite(summary.empty)
    ? summary.empty
    : undefined;
  const errors = typeof summary?.errors === 'number' && Number.isFinite(summary.errors)
    ? summary.errors
    : undefined;

  if (found !== undefined && empty !== undefined && errors !== undefined) {
    return `Fontes com dados: ${found}; sem dados: ${empty}; com erro: ${errors}.`;
  }

  const indices = Array.isArray(data.indices) ? data.indices.length : 0;
  return `Dossiê processado; ${indices} fontes consultadas.`;
}

function dossierSources(payload: Record<string, unknown>): string[] {
  const data = getData(payload);

  if (!Array.isArray(data.indices)) {
    return [];
  }

  return data.indices.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const label = firstString(entry.label, entry.id);
    return label ? [label] : [];
  });
}

function normalizeDossierResult(
  payload: Record<string, unknown>,
  requestedCpf: string,
): Record<string, unknown> {
  const data = getData(payload);

  if ((data.success ?? payload.success) !== true || !Array.isArray(data.indices) || !isRecord(data.summary)) {
    throw new ProviderError('QUERY_FAILED', 'O provider Athenas devolveu um Dossiê 360 inválido.');
  }

  const returnedCpf = firstString(data.cpf, payload.cpf);
  if (returnedCpf && returnedCpf.replace(/\D/gu, '') !== requestedCpf) {
    throw new ProviderError('QUERY_FAILED', 'O provedor devolveu dados incompatíveis com a consulta.');
  }

  return {
    ...payload,
    resumo: summarizeDossier(payload),
    fontes: dossierSources(payload),
  };
}

export class AthenasProvider implements ProviderClient {
  private readonly baseUrl: URL;
  private readonly fetcher: typeof fetch;

  constructor(options: AthenasProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new Error('ATHENAS_API_KEY precisa estar configurada para usar o provider Athenas.');
    }

    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_ATHENAS_API_BASE_URL);
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(this.baseUrl.hostname);
    const isAllowedProtocol = this.baseUrl.protocol === 'https:' || (this.baseUrl.protocol === 'http:' && isLoopback);
    if (
      !isAllowedProtocol ||
      this.baseUrl.username ||
      this.baseUrl.password ||
      this.baseUrl.search ||
      this.baseUrl.hash
    ) {
      throw new Error('ATHENAS_API_BASE_URL precisa ser HTTPS, sem credenciais, query ou fragmento.');
    }

    this.baseUrl.pathname = `${this.baseUrl.pathname.replace(/\/+$/u, '')}/`;
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.apiKey = apiKey;
  }

  private readonly apiKey: string;

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    const route = routeFor(request);
    const url = new URL(route.endpoint.replace(/^\//u, ''), this.baseUrl);
    const timeoutSignal = AbortSignal.timeout(route.timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: 'GET',
        headers: { 'X-API-Key': this.apiKey, Accept: 'application/json' },
        signal,
      });
    } catch {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Não foi possível acessar o provider Athenas.');
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);

      if (response.status === 400 || response.status === 404) {
        throw new ProviderError('QUERY_FAILED', 'A consulta não retornou dados válidos.');
      }

      throw new ProviderError('PROVIDER_UNAVAILABLE', 'O provider Athenas está temporariamente indisponível.');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (signal.aborted) {
        throw new ProviderError('PROVIDER_UNAVAILABLE', 'O tempo limite do provider Athenas expirou.');
      }

      throw new ProviderError('QUERY_FAILED', 'O provider Athenas devolveu JSON inválido.');
    }

    if (!isRecord(payload) || typeof payload.error === 'string') {
      throw new ProviderError('QUERY_FAILED', 'O provider Athenas devolveu uma resposta inválida.');
    }

    const data = request.module === 'cpf-basico'
      ? normalizeCpfResult(payload, request.input.cpf as string)
      : normalizeDossierResult(payload, request.input.cpf as string);

    return { kind: 'result', data };
  }

  async poll(): Promise<ProviderResult> {
    throw new ProviderError('PROVIDER_UNAVAILABLE', 'A API Athenas responde as consultas diretamente.');
  }
}
