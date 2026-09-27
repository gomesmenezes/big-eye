'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { QueryDTOType } from '@big-eye/contracts';

import { QueryForm } from '../../../../components/query-form';
import { QueryResult } from '../../../../components/query-result';
import { apiFetch, apiFetchPath, apiFetchStream, ApiError, consumeSse, type ModuleDTOType, type SsePayload } from '../../../../lib/api';

type QueryPageClientProps = {
  slug: string;
};

const terminalStatuses: QueryDTOType['status'][] = ['succeeded', 'failed', 'refunded'];

export default function QueryPageClient({ slug }: QueryPageClientProps) {
  const [module, setModule] = useState<ModuleDTOType>();
  const [query, setQuery] = useState<QueryDTOType>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbort = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const modules = await apiFetchPath('/modules');
        const selected = modules.find((candidate) => candidate.slug === slug);

        if (!selected) {
          throw new Error('Módulo não encontrado.');
        }

        if (active) {
          setModule(selected);
        }
      } catch (caughtError) {
        if (active) {
          setError(errorMessage(caughtError, 'Não foi possível carregar este módulo.'));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      streamAbort.current?.abort();
    };
  }, [slug]);

  async function submit(input: Record<string, unknown>): Promise<void> {
    if (!module) {
      return;
    }

    streamAbort.current?.abort();
    setError(undefined);
    setQuery(undefined);
    setIsStreaming(false);

    let created: QueryDTOType;

    try {
      created = await apiFetch<QueryDTOType>('/queries', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ moduleSlug: module.slug, input }),
      });
    } catch (caughtError) {
      throw new Error(errorMessage(caughtError, 'Não foi possível iniciar a consulta.'));
    }

    setQuery(created);

    if (created.mode === 'async' && !terminalStatuses.includes(created.status)) {
      await followAsyncQuery(created);
    }
  }

  async function followAsyncQuery(initialQuery: QueryDTOType): Promise<void> {
    const controller = new AbortController();
    streamAbort.current = controller;
    setIsStreaming(true);

    try {
      const response = await apiFetchStream(`/queries/${initialQuery.id}/stream`, {
        signal: controller.signal,
      });

      await consumeSse(response, (payload) => {
        updateQueryFromEvent(initialQuery, payload);
      });
    } catch (caughtError) {
      if (controller.signal.aborted) {
        return;
      }

      try {
        await pollQuery(initialQuery.id, controller.signal);
      } catch (pollError) {
        setError(errorMessage(pollError ?? caughtError, 'Não foi possível acompanhar o resultado.'));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsStreaming(false);
      }
    }
  }

  function updateQueryFromEvent(initialQuery: QueryDTOType, payload: SsePayload): void {
    const status = queryStatus(payload.status);
    const errorCode = queryErrorCode(payload.errorCode);

    if (!status) {
      return;
    }

    setQuery((current) => ({
      ...(current ?? initialQuery),
      status,
      ...(payload.data !== undefined ? { data: payload.data } : {}),
      ...(errorCode !== undefined ? { errorCode } : {}),
      ...(typeof payload.errorMessage === 'string' || payload.errorMessage === null ? { errorMessage: payload.errorMessage } : {}),
      ...(payload.resultExpired === true ? { resultExpired: true } : {}),
    }));
  }

  async function pollQuery(queryId: string, signal: AbortSignal): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (signal.aborted) {
        return;
      }

      await wait(800, signal);
      const current = await apiFetch<QueryDTOType>(`/queries/${queryId}`, { signal });
      setQuery(current);

      if (terminalStatuses.includes(current.status)) {
        return;
      }
    }

    throw new Error('O processamento está demorando mais que o esperado. Consulte o histórico em instantes.');
  }

  function resetQuery(): void {
    streamAbort.current?.abort();
    setQuery(undefined);
    setIsStreaming(false);
    setError(undefined);
  }

  if (isLoading) {
    return <PageFrame><div className="h-8 w-72 animate-pulse rounded bg-slate-200" /></PageFrame>;
  }

  if (error || !module) {
    return <PageFrame><ErrorPanel message={error ?? 'Módulo não encontrado.'} /></PageFrame>;
  }

  if (!module.implemented) {
    return (
      <PageFrame>
        <Link className="text-sm font-semibold text-petrol-700 hover:text-petrol-800" href="/catalogo">← Voltar ao catálogo</Link>
        <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-8">
          <h1 className="text-2xl font-semibold text-amber-950">Módulo em preparação</h1>
          <p className="mt-2 text-sm text-amber-900">Este módulo ainda não está disponível para consultas.</p>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <Link className="text-sm font-semibold text-petrol-700 hover:text-petrol-800" href="/catalogo">← Voltar ao catálogo</Link>
      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-petrol-600">{module.mode === 'async' ? 'Consulta acompanhada' : 'Consulta imediata'}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{module.nome}</h1>
          <p className="mt-3 leading-7 text-slate-600">{module.descricao}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {module.tags.map((tag) => <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600" key={tag}>{tag}</span>)}
          </div>
          <div className="mt-8 rounded-2xl border border-petrol-100 bg-petrol-50 p-5 text-sm text-petrol-900">
            <p className="font-semibold">{module.custoCreditos} crédito{module.custoCreditos === 1 ? '' : 's'} por consulta</p>
            <p className="mt-1">O saldo só é debitado quando a consulta é criada. Em uma falha elegível, o crédito é reembolsado pela plataforma.</p>
          </div>
        </div>
        <div className="space-y-6">
          <QueryForm disabled={isStreaming} module={module} onSubmit={submit} />
          <QueryResult isStreaming={isStreaming} onRetry={resetQuery} query={query} />
          {error ? <ErrorPanel message={error} /> : null}
        </div>
      </section>
    </PageFrame>
  );
}

function queryStatus(value: unknown): QueryDTOType['status'] | undefined {
  return typeof value === 'string' && ['pending', 'running', 'succeeded', 'failed', 'refunded'].includes(value)
    ? value as QueryDTOType['status']
    : undefined;
}

function queryErrorCode(value: unknown): QueryDTOType['errorCode'] | undefined {
  if (value === null) {
    return null;
  }

  const codes: QueryDTOType['errorCode'][] = [
    'INSUFFICIENT_CREDITS',
    'MODULE_NOT_FOUND',
    'INVALID_INPUT',
    'QUERY_FAILED',
    'PROVIDER_UNAVAILABLE',
    'PAYMENT_NOT_FOUND',
    'FORBIDDEN',
    'UNAUTHORIZED',
  ];

  return typeof value === 'string' && codes.includes(value as QueryDTOType['errorCode'])
    ? value as QueryDTOType['errorCode']
    : undefined;
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('A consulta foi cancelada.', 'AbortError'));
    }, { once: true });
  });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null) {
    const code = (error.body as { code?: unknown }).code;
    const messages: Record<string, string> = {
      INSUFFICIENT_CREDITS: 'Você não tem créditos suficientes. Compre créditos para continuar.',
      INVALID_INPUT: 'Confira os dados informados e tente novamente.',
      PROVIDER_UNAVAILABLE: 'O provedor está temporariamente indisponível.',
      MODULE_NOT_FOUND: 'Este módulo não está disponível.',
    };
    if (typeof code === 'string' && messages[code]) {
      return messages[code];
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function PageFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>;
}

function ErrorPanel({ message }: Readonly<{ message: string }>) {
  return <p className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800" role="alert">{message}</p>;
}
