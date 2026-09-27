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

import { apiFetch } from './api';

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
});
