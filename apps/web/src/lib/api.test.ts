import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeDTOType } from '@big-eye/contracts';

const { auth } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    refreshSession: vi.fn(),
  },
}));

vi.mock('./supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth }),
}));

import { apiFetch, consumeSse, getApiUrl } from './api';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.example.test');
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'access-token-1' } },
    });
    auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'access-token-2' } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('anexa o Bearer da sessão atual', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-id' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<MeDTOType>('/me');
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(result).toEqual({ id: 'user-id' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.example.test/me',
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(new Headers(requestInit.headers).get('Authorization')).toBe('Bearer access-token-1');
  });

  it('atualiza a sessão e repete uma vez quando recebe 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user-id' }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch<MeDTOType>('/me');

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(firstInit.headers).get('Authorization')).toBe('Bearer access-token-1');
    expect(new Headers(secondInit.headers).get('Authorization')).toBe('Bearer access-token-2');
  });

  it('não tenta renovar duas vezes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('compartilha um único refresh entre chamadas concorrentes', async () => {
    let releaseRefresh: ((value: { data: { session: { access_token: string } } }) => void) | undefined;
    const refresh = new Promise<{ data: { session: { access_token: string } } }>((resolve) => {
      releaseRefresh = resolve;
    });
    auth.refreshSession.mockReturnValue(refresh);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValue(new Response(JSON.stringify({ id: 'user-id' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }));
    vi.stubGlobal('fetch', fetchMock);

    const first = apiFetch<MeDTOType>('/me');
    const second = apiFetch<MeDTOType>('/me');

    await vi.waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(1));
    releaseRefresh?.({ data: { session: { access_token: 'access-token-2' } } });
    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('não encaminha um Authorization manual sem sessão', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-id' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/me', { headers: { Authorization: 'Bearer stale-token' } });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(requestInit.headers).has('Authorization')).toBe(false);
  });

  it('exige a URL pública da API e rejeita destinos externos', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test/');

    expect(getApiUrl('/me')).toBe('https://api.example.test/me');
    expect(() => getApiUrl('https://evil.example.test/me')).toThrow(
      'O caminho da API deve ser relativo',
    );
  });

  it('consome eventos SSE mesmo quando um frame chega em mais de um chunk', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"status":"running"}\n\n',
      'data: {"status":"suc',
      'ceeded","data":{"ok":true}}\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    const response = new Response(stream, {
      headers: { 'content-type': 'text/event-stream' },
    });
    const events: Record<string, unknown>[] = [];

    await consumeSse(response, (event) => {
      events.push(event);
    });

    expect(events).toEqual([
      { status: 'running' },
      { status: 'succeeded', data: { ok: true } },
    ]);
  });
});
