'use client';

import { ChevronLeft, Coins } from 'lucide-react';
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
const QUERY_POLL_INTERVAL_MS = 1_500;
const QUERY_POLL_ATTEMPTS = 40;
const SSE_RECONNECT_DELAY_MS = 1_000;

export default function QueryPageClient({ slug }: QueryPageClientProps) {
  const [module, setModule] = useState<ModuleDTOType>();
  const [query, setQuery] = useState<QueryDTOType>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbort = useRef<AbortController | undefined>(undefined);
  const pendingIdempotency = useRef<{ fingerprint: string; key: string } | undefined>(undefined);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const modules = await apiFetchPath('/modules');
        const selected = modules.find((candidate) => candidate.slug === slug);

        if (!selected) {
          throw new Error('Chamada/Consulta não encontrada.');
        }

        if (active) {
          setModule(selected);
        }
      } catch (caughtError) {
        if (active) {
          setError(errorMessage(caughtError, 'Não foi possível carregar esta Chamada/Consulta.'));
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
    const fingerprint = `${module.slug}:${JSON.stringify(input)}`;
    const idempotency = pendingIdempotency.current?.fingerprint === fingerprint
      ? pendingIdempotency.current.key
      : crypto.randomUUID();
    pendingIdempotency.current = { fingerprint, key: idempotency };

    try {
      created = await apiFetch<QueryDTOType>('/queries', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotency },
        body: JSON.stringify({ moduleSlug: module.slug, input }),
      });
    } catch (caughtError) {
      throw new Error(errorMessage(caughtError, 'Não foi possível iniciar a consulta.'));
    }

    pendingIdempotency.current = undefined;
    setQuery(created);

    if (created.mode === 'async' && !terminalStatuses.includes(created.status)) {
      await followAsyncQuery(created);
    }
  }

  async function followAsyncQuery(initialQuery: QueryDTOType): Promise<void> {
    const controller = new AbortController();
    streamAbort.current = controller;
    setIsStreaming(true);

    const streamTask = watchSse(initialQuery, controller.signal);

    try {
      await pollQuery(initialQuery.id, controller.signal);
    } catch (caughtError) {
      if (!controller.signal.aborted) {
        setError(errorMessage(caughtError, 'Não foi possível acompanhar o resultado.'));
      }
    } finally {
      controller.abort();
      await streamTask;

      if (streamAbort.current === controller) {
        streamAbort.current = undefined;
        setIsStreaming(false);
      }
    }
  }

  async function watchSse(initialQuery: QueryDTOType, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      let terminalEvent = false;

      try {
        const response = await apiFetchStream(`/queries/${initialQuery.id}/stream`, { signal });

        await consumeSse(response, (payload) => {
          const status = queryStatus(payload.status);
          if (status && terminalStatuses.includes(status)) {
            terminalEvent = true;
          }
          updateQueryFromEvent(initialQuery, payload);
        });

        if (terminalEvent || signal.aborted) {
          return;
        }
      } catch {
        if (signal.aborted) {
          return;
        }
      }

      try {
        await wait(SSE_RECONNECT_DELAY_MS, signal);
      } catch {
        return;
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
    for (let attempt = 0; attempt < QUERY_POLL_ATTEMPTS; attempt += 1) {
      if (signal.aborted) {
        return;
      }

      const current = await apiFetch<QueryDTOType>(`/queries/${queryId}`, { signal });
      setQuery(current);

      if (terminalStatuses.includes(current.status)) {
        return;
      }

      await wait(QUERY_POLL_INTERVAL_MS, signal);
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
    return <PageFrame><div className="h-8 w-72 animate-pulse rounded bg-[#0d121c]" /></PageFrame>;
  }

  if (error || !module) {
    return <PageFrame><ErrorPanel message={error ?? 'Chamada/Consulta não encontrada.'} /></PageFrame>;
  }

  if (!module.implemented) {
    return (
      <PageFrame>
        <Link className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300" href="/catalogo">
          <ChevronLeft className="h-4 w-4" />
          <span>Voltar ao catálogo</span>
        </Link>
        <div className="mt-8 rounded-2xl border border-amber-900/40 bg-amber-950/20 p-8">
          <h1 className="text-xl font-bold text-amber-200">Chamada/Consulta em preparação</h1>
          <p className="mt-2 text-xs text-amber-300">Esta Chamada/Consulta ainda não está disponível para consultas.</p>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <Link
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-cyan-400"
        href="/catalogo"
      >
        <span>← Voltar ao catálogo</span>
      </Link>

      <section className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400" />
            <p className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
              {module.mode === 'async' ? 'Consulta acompanhada' : 'Consulta imediata'}
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {module.nome}
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">{module.descricao}</p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {module.tags.map((tag) => (
              <span
                className="rounded-full border border-[#1c2436] bg-[#121824] px-2.5 py-0.5 text-[10px] font-semibold text-slate-300"
                key={tag}
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-[#1c2436] bg-[#0d121c] p-6 text-xs text-slate-300 shadow-card">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Coins className="h-4 w-4 text-cyan-400" />
              <span>{module.custoCreditos} crédito{module.custoCreditos === 1 ? '' : 's'} por consulta</span>
            </div>
            <p className="mt-2 leading-relaxed text-slate-400">
              O débito do crédito ocorre na inicialização da consulta. Em caso de falha elegível de resposta dos provedores, o crédito é estornado automaticamente para a sua conta.
            </p>
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
    let settled = false;
    const onAbort = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('A consulta foi cancelada.', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null) {
    const code = (error.body as { code?: unknown }).code;
    const messages: Record<string, string> = {
      INSUFFICIENT_CREDITS: 'Você não tem créditos suficientes. Compre créditos para continuar.',
      INVALID_INPUT: 'Confira os dados informados e tente novamente.',
      PROVIDER_UNAVAILABLE: 'O provedor está temporariamente indisponível.',
      MODULE_NOT_FOUND: 'Esta Chamada/Consulta não está disponível.',
    };
    if (typeof code === 'string' && messages[code]) {
      return messages[code];
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function PageFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="space-y-6">{children}</div>;
}

function ErrorPanel({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-xs text-red-300" role="alert">
      {message}
    </div>
  );
}
