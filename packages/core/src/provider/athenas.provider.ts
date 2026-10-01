import type {
  ProviderClient,
  ProviderRequest,
  ProviderResult,
} from './provider.client.js';
import { ProviderError } from './provider.client.js';

export const DEFAULT_ATHENAS_API_BASE_URL = 'https://api.athenasbuscas.com/api/ext/v1';

const CPF_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DOSSIER_TIMEOUT_MS = 60_000;
const STATUS_TIMEOUT_MS = 15_000;

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

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProviderError('QUERY_FAILED', 'A entrada da consulta não é válida.');
  }

  return value.trim();
}

function requiredCpf(input: Record<string, unknown>): string {
  const cpf = requiredString(input, 'cpf');
  if (!/^\d{11}$/u.test(cpf)) {
    throw new ProviderError('QUERY_FAILED', 'A entrada da consulta não é válida.');
  }

  return cpf;
}

function queryValue(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  throw new ProviderError('QUERY_FAILED', 'A entrada da consulta não é válida.');
}

function queryEndpoint(
  path: string,
  input: Record<string, unknown>,
  requiredKey: string,
  optionalKeys: readonly string[] = [],
): string {
  const params = new URLSearchParams();
  params.set(requiredKey, requiredString(input, requiredKey));

  for (const key of optionalKeys) {
    const value = input[key];
    if (value !== undefined && value !== null) {
      params.set(key, queryValue(value));
    }
  }

  return `${path}?${params.toString()}`;
}

function optionalQueryEndpoint(
  path: string,
  input: Record<string, unknown>,
  optionalKeys: readonly string[],
): string {
  const params = new URLSearchParams();

  for (const key of optionalKeys) {
    const value = input[key];
    if (value !== undefined && value !== null) {
      params.set(key, queryValue(value));
    }
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function routeFor(request: ProviderRequest): AthenasRoute {
  switch (request.module) {
    case 'cpf-basico': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/cpf/${encodeURIComponent(cpf)}`, timeoutMs: CPF_TIMEOUT_MS };
    }
    case 'dossie-360': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/dossie-360/${encodeURIComponent(cpf)}`, timeoutMs: DOSSIER_TIMEOUT_MS };
    }
    case 'cpf-cadsus': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/cadsus/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'cpf-intelligent': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/cpf-intelligent/${encodeURIComponent(cpf)}`, timeoutMs: CPF_TIMEOUT_MS };
    }
    case 'cpf-obito': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/obito/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'cpf-parentes': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/parentes/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'cpf-score': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/score/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'cpf-detran': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/cpf-detran/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'sptrans-cpf': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/sptrans/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'email-reverso': {
      const email = requiredString(request.input, 'email');
      return { endpoint: `/email/${encodeURIComponent(email)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'telefone-reverso': {
      const phone = requiredString(request.input, 'phone');
      return { endpoint: `/phone/${encodeURIComponent(phone)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'nome-abreviado':
      return {
        endpoint: queryEndpoint('/name-abbreviated', request.input, 'query', [
          'page',
          'limit',
          'sexo',
          'uf',
          'cidade',
          'cep',
          'flag_obito',
          'faixa_renda',
          'nascimento_exact',
          'year_from',
          'year_to',
        ]),
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    case 'nome-completo':
      return {
        endpoint: queryEndpoint('/name', request.input, 'query', [
          'page',
          'limit',
          'sexo',
          'uf',
          'cidade',
          'cep',
          'flag_obito',
          'faixa_renda',
          'nascimento_exact',
          'year_from',
          'year_to',
        ]),
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    case 'endereco-consulta':
      return {
        endpoint: queryEndpoint('/address', request.input, 'query', ['page', 'limit']),
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    case 'placa-basico': {
      const plate = requiredString(request.input, 'plate');
      return { endpoint: `/plate/${encodeURIComponent(plate)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'chassi-consulta': {
      const chassi = requiredString(request.input, 'chassi');
      return { endpoint: `/chassi/${encodeURIComponent(chassi)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'renavam-consulta': {
      const renavam = requiredString(request.input, 'renavam');
      return { endpoint: `/renavam/${encodeURIComponent(renavam)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'cnpj-basico': {
      const cnpj = requiredString(request.input, 'cnpj');
      return { endpoint: `/cnpj/${encodeURIComponent(cnpj)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'cnpj-funcionarios': {
      const cnpj = requiredString(request.input, 'cnpj');
      return {
        endpoint: optionalQueryEndpoint(
          `/employees/${encodeURIComponent(cnpj)}`,
          request.input,
          ['page', 'pageSize', 'q', 'ano'],
        ),
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    }
    case 'ip-geolocalizacao': {
      const ip = requiredString(request.input, 'ip');
      return { endpoint: `/ip/${encodeURIComponent(ip)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'dominio-whois': {
      const domain = requiredString(request.input, 'domain');
      return { endpoint: `/domain/${encodeURIComponent(domain)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'logins-vazados':
      return {
        endpoint: queryEndpoint('/leaked-logins', request.input, 'q', [
          'type',
          'page',
          'limit',
          'root_domain',
          'scope',
        ]),
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
    case 'cpf-rais': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/rais/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'pis-pasep': {
      const pis = requiredString(request.input, 'pis');
      return { endpoint: `/pis/${encodeURIComponent(pis)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    case 'irpf-cpf': {
      const cpf = requiredCpf(request.input);
      return { endpoint: `/irpf/${encodeURIComponent(cpf)}`, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    default:
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'Módulo sem integração Athenas.');
  }
}

function containsCredentialKey(key: string): boolean {
  const normalized = key.replace(/([a-z0-9])([A-Z])/gu, '$1_$2').toLowerCase();
  return normalized.split(/[^a-z0-9]+/u).some((part) =>
    part === 'pass' ||
    part.startsWith('password') ||
    part.startsWith('senha') ||
    part.startsWith('credential') ||
    part.startsWith('token') ||
    part.startsWith('secret') ||
    part.startsWith('cookie'),
  );
}

function removeCredentialFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeCredentialFields);
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (!containsCredentialKey(key)) {
      sanitized[key] = removeCredentialFields(nestedValue);
    }
  }

  return sanitized;
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

  private async requestJson(
    endpoint: string,
    timeoutMs: number,
    requestSignal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const url = new URL(endpoint.replace(/^\//u, ''), this.baseUrl);
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = requestSignal
      ? AbortSignal.any([requestSignal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: 'GET',
        headers: { 'X-API-Key': this.apiKey, Accept: 'application/json' },
        redirect: 'error',
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

    return payload;
  }

  async execute(request: ProviderRequest): Promise<ProviderResult> {
    const route = routeFor(request);
    const payload = await this.requestJson(route.endpoint, route.timeoutMs, request.signal);

    let data: unknown = payload;
    if (request.module === 'cpf-basico') {
      data = normalizeCpfResult(payload, requiredCpf(request.input));
    } else if (request.module === 'dossie-360') {
      data = normalizeDossierResult(payload, requiredCpf(request.input));
    } else if (request.module === 'logins-vazados') {
      data = removeCredentialFields(payload);
    }

    return { kind: 'result', data };
  }

  async poll(): Promise<ProviderResult> {
    throw new ProviderError('PROVIDER_UNAVAILABLE', 'A API Athenas responde as consultas diretamente.');
  }

  async status(signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this.requestJson('/status', STATUS_TIMEOUT_MS, signal);
  }
}
