'use client';

import type { QueryDTOType } from '@big-eye/contracts';

type QueryResultProps = {
  query?: QueryDTOType;
  isStreaming?: boolean;
  onRetry?: () => void;
};

const statusLabels: Record<QueryDTOType['status'], string> = {
  pending: 'Consulta na fila',
  running: 'Consulta em andamento',
  succeeded: 'Consulta concluída',
  failed: 'Consulta falhou',
  refunded: 'Créditos reembolsados',
};

export function QueryResult({ query, isStreaming = false, onRetry }: QueryResultProps) {
  if (!query) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <div>
          <p className="font-medium text-slate-800">Seu resultado aparecerá aqui</p>
          <p className="mt-1 text-sm text-slate-500">A consulta fica vinculada ao seu histórico.</p>
        </div>
      </div>
    );
  }

  const terminal = ['succeeded', 'failed', 'refunded'].includes(query.status);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol-600">Resultado</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{statusLabels[query.status]}</h2>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {query.creditsCharged} crédito{query.creditsCharged === 1 ? '' : 's'}
        </span>
      </div>

      {isStreaming ? (
        <div className="mt-8 rounded-xl bg-petrol-50 p-5">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-petrol-600" />
            <p className="text-sm font-medium text-petrol-900">Acompanhando o processamento em tempo real...</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-petrol-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-petrol-500" />
          </div>
        </div>
      ) : null}

      {!isStreaming && !terminal ? (
        <div className="mt-8 rounded-xl bg-amber-50 p-5 text-sm text-amber-900" role="status">
          O acompanhamento foi pausado. Consulte o histórico em alguns instantes ou faça uma nova consulta.
          {onRetry ? <button className="mt-3 block font-semibold text-amber-950 underline" onClick={onRetry} type="button">Fazer nova consulta</button> : null}
        </div>
      ) : null}

      {query.status === 'succeeded' && query.resultExpired ? (
        <div className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900">
          O resultado expirou do cache. Faça uma nova consulta para consultar os dados novamente.
          {onRetry ? <button className="mt-3 block font-semibold text-amber-950 underline" onClick={onRetry} type="button">Fazer nova consulta</button> : null}
        </div>
      ) : null}

      {query.status === 'succeeded' && query.data !== undefined && !query.resultExpired ? (
        <ResultData data={query.data} />
      ) : null}

      {query.status === 'failed' || query.status === 'refunded' ? (
        <div className="mt-6 rounded-xl bg-red-50 p-5 text-sm text-red-800">
          {query.errorMessage ?? 'A consulta não pôde ser concluída.'}
        </div>
      ) : null}
    </section>
  );
}

function ResultData({ data }: { data: unknown }) {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const entries = Object.entries(data);

    return (
      <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {entries.map(([key, value]) => (
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4" key={key}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</dt>
            <dd className={`break-words text-sm text-slate-900 ${key.toLowerCase().includes('cpf') ? 'font-mono' : ''}`}>{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <pre className="mt-6 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">{JSON.stringify(data, null, 2)}</pre>;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(', ');
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}
