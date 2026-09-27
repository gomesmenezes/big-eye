'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { MeDTOType, QueryDTOType } from '@big-eye/contracts';

import { apiFetchPath } from '../../../lib/api';

const statusLabels: Record<QueryDTOType['status'], string> = {
  pending: 'Na fila',
  running: 'Processando',
  succeeded: 'Concluída',
  failed: 'Falhou',
  refunded: 'Reembolsada',
};

const statusClasses: Record<QueryDTOType['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  running: 'bg-petrol-50 text-petrol-700',
  succeeded: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  refunded: 'bg-violet-50 text-violet-700',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeDTOType>();
  const [queries, setQueries] = useState<QueryDTOType[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const [profile, recentQueries] = await Promise.all([
          apiFetchPath('/me'),
          apiFetchPath('/queries'),
        ]);

        if (active) {
          setMe(profile);
          setQueries(recentQueries.slice(0, 5));
        }
      } catch {
        if (active) {
          setError('Não foi possível carregar seu painel agora. Tente novamente em instantes.');
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
    };
  }, []);

  if (isLoading) {
    return <LoadingPanel />;
  }

  if (error || !me) {
    return (
      <PageFrame>
        <ErrorPanel message={error ?? 'Não foi possível carregar seu perfil.'} />
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-petrol-600">Visão geral</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Olá, {me.name || me.email.split('@')[0]}
          </h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Escolha uma consulta no catálogo e acompanhe o resultado em um só lugar.
          </p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-xl bg-petrol-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-petrol-700"
          href="/catalogo"
        >
          Nova consulta
        </Link>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="relative overflow-hidden rounded-2xl bg-petrol-950 p-6 text-white shadow-sm sm:col-span-2">
          <div className="relative z-10 flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-petrol-200">Saldo disponível</p>
              <p className="mt-2 text-6xl font-semibold tracking-tight" data-testid="balance">{me.balance}</p>
              <p className="mt-1 text-sm text-petrol-200">crédito{me.balance === 1 ? '' : 's'} para consultas</p>
            </div>
            <Link className="text-sm font-semibold text-white underline decoration-petrol-400 underline-offset-4 hover:text-petrol-200" href="/creditos">
              Gerenciar carteira →
            </Link>
          </div>
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[24px] border-petrol-800/70" />
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Consultas recentes</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{queries.length}</p>
          <Link className="mt-1 inline-block text-sm font-medium text-petrol-700 hover:text-petrol-800" href="/catalogo">
            Explorar módulos
          </Link>
        </article>
        <article className="rounded-2xl border border-dashed border-slate-300 bg-transparent p-5">
          <p className="text-sm font-medium text-slate-500">Precisa de créditos?</p>
          <p className="mt-3 text-base font-semibold text-slate-950">Continue consultando</p>
          <Link className="mt-1 inline-block text-sm font-medium text-petrol-700 hover:text-petrol-800" href="/creditos">
            Ver pacotes
          </Link>
        </article>
      </section>

      {me.balance === 0 ? (
        <section className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-petrol-100 bg-petrol-50 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-petrol-950">Seu saldo está zerado</h2>
            <p className="mt-1 text-sm text-petrol-800">Compre créditos para liberar suas próximas consultas.</p>
          </div>
          <Link className="inline-flex items-center justify-center rounded-lg bg-petrol-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-petrol-700" href="/creditos">
            Comprar créditos
          </Link>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Últimas consultas</h2>
            <p className="mt-1 text-sm text-slate-500">Acompanhe o que você consultou recentemente.</p>
          </div>
          <Link className="text-sm font-semibold text-petrol-700 hover:text-petrol-800" href="/catalogo">
            Ver catálogo
          </Link>
        </div>

        {queries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-medium text-slate-800">Você ainda não fez uma consulta.</p>
            <p className="mt-1 text-sm text-slate-500">Comece pelo catálogo de módulos disponíveis.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {queries.map((query) => (
                <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" key={query.id}>
                  <div>
                    <Link className="font-mono text-sm font-medium text-slate-900 hover:text-petrol-700" href={`/consulta/${query.moduleSlug}`}>
                      {query.moduleSlug}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(query.createdAt)}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[query.status]}`}>
                    {statusLabels[query.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </PageFrame>
  );
}

function PageFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>;
}

function LoadingPanel() {
  return (
    <PageFrame>
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 rounded bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
        <div className="grid gap-4 pt-8 sm:grid-cols-3">
          {[1, 2, 3].map((item) => <div className="h-32 rounded-2xl bg-slate-200" key={item} />)}
        </div>
      </div>
    </PageFrame>
  );
}

function ErrorPanel({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800" role="alert">
      {message}
    </div>
  );
}
