import type {
  AthenasStatusResponseDTOType,
  MeDTOType,
  PackageDTOType,
  PaymentDTOType,
  QueryDTOType,
  TransactionDTOType,
} from '@big-eye/contracts';

import { createSupabaseBrowserClient } from './supabase/client';

type BrowserSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;

let refreshPromise: Promise<string | undefined> | undefined;

export type ModuleDTOType = {
  slug: string;
  nome: string;
  categoria: 'pessoais' | 'veiculares' | 'empresariais' | 'web';
  tags: string[];
  descricao: string;
  destaque?: boolean;
  custoCreditos: number;
  mode: 'sync' | 'async';
  implemented: boolean;
};

type ApiResponseByPath = {
  '/me': MeDTOType;
  '/athenas/status': AthenasStatusResponseDTOType;
  '/modules': ModuleDTOType[];
  '/queries': QueryDTOType[];
  '/packages': PackageDTOType[];
  '/payments/:id': PaymentDTOType;
  '/queries/:id': QueryDTOType;
  '/credits/transactions': TransactionDTOType[];
};

export type ApiPath = keyof ApiResponseByPath;

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function getApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error('A API pública não está configurada. Defina NEXT_PUBLIC_API_URL.');
  }

  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(path)) {
    throw new Error('O caminho da API deve ser relativo ao endpoint configurado.');
  }

  return `${baseUrl.replace(/\/$/u, '')}/${path.replace(/^\//u, '')}`;
}

function buildHeaders(init: RequestInit, accessToken?: string): Headers {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  // apiFetch owns authentication. Never forward a stale or caller supplied
  // token when the current Supabase session has no access token.
  headers.delete('Authorization');

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  return response.text();
}

function refreshAccessToken(supabase: BrowserSupabaseClient): Promise<string | undefined> {
  if (!refreshPromise) {
    refreshPromise = supabase.auth
      .refreshSession()
      .then(({ data: { session } }) => session?.access_token)
      .catch(() => undefined)
      .finally(() => {
        refreshPromise = undefined;
      });
  }

  return refreshPromise;
}

/**
 * Call the API with the current Supabase access token. A 401 refreshes the
 * session once and retries the same request with the new token.
 */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let accessToken = session?.access_token;

  const request = async (retry = false): Promise<T> => {
    const response = await fetch(getApiUrl(path), {
      ...init,
      headers: buildHeaders(init, accessToken),
    });

    if (response.status === 401 && !retry) {
      const refreshedAccessToken = await refreshAccessToken(supabase);

      if (refreshedAccessToken) {
        accessToken = refreshedAccessToken;
        return request(true);
      }
    }

    const body = await parseResponse(response);
    if (!response.ok) {
      throw new ApiError(response.status, body);
    }

    return body as T;
  };

  return request();
}

/**
 * Fetch an authenticated response without consuming its body. This is used
 * for the query SSE endpoint because native EventSource cannot send a Bearer
 * header when the API is hosted on a different origin.
 */
export async function apiFetchStream(path: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let accessToken = session?.access_token;

  const request = async (retry = false): Promise<Response> => {
    const headers = buildHeaders(init, accessToken);
    headers.set('Accept', 'text/event-stream');
    const response = await fetch(getApiUrl(path), {
      ...init,
      headers,
    });

    if (response.status === 401 && !retry) {
      const refreshedAccessToken = await refreshAccessToken(supabase);

      if (refreshedAccessToken) {
        accessToken = refreshedAccessToken;
        return request(true);
      }
    }

    if (!response.ok) {
      const body = await parseResponse(response);
      throw new ApiError(response.status, body);
    }

    return response;
  };

  return request();
}

export type SsePayload = Record<string, unknown>;

/** Read JSON data frames from an SSE response until the server closes it. */
export async function consumeSse(
  response: Response,
  onEvent: (payload: SsePayload) => void | Promise<void>,
): Promise<void> {
  if (!response.body) {
    throw new Error('A resposta SSE não contém um stream legível.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consumeFrame = async (frame: string): Promise<void> => {
    const data = frame
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (!data) {
      return;
    }

    const parsed: unknown = JSON.parse(data);

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      await onEvent(parsed as SsePayload);
    }
  };

  try {
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });

      const frames = buffer.split(/\r?\n\r?\n/u);
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        await consumeFrame(frame);
      }

      if (done) {
        if (buffer.trim()) {
          await consumeFrame(buffer);
        }
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function apiFetchPath<P extends ApiPath>(
  path: P,
  init?: RequestInit,
): Promise<ApiResponseByPath[P]> {
  return apiFetch<ApiResponseByPath[P]>(path, init);
}
