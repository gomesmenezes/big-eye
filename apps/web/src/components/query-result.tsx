'use client';

import {
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Copy,
  Check,
  Coins,
} from 'lucide-react';
import { useState } from 'react';

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
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#1c2436] bg-[#0d121c] p-8 text-center shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#121824] text-slate-500 border border-[#1c2436]">
          <FileText className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-bold text-white">Seu resultado aparecerá aqui</p>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          Após enviar a consulta, os dados retornados pelos provedores serão processados e exibidos nesta área.
        </p>
      </div>
    );
  }

  const terminal = ['succeeded', 'failed', 'refunded'].includes(query.status);

  return (
    <section aria-live="polite" className="rounded-2xl border border-[#1c2436] bg-[#0d121c] p-6 shadow-card sm:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          {query.status === 'succeeded' ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 shadow-glow">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          ) : query.status === 'failed' ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950/70 text-red-400 border border-red-800/50">
              <XCircle className="h-5 w-5" />
            </div>
          ) : query.status === 'refunded' ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-950/70 text-sky-400 border border-sky-800/50 shadow-glow">
              <RotateCcw className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/70 text-cyan-400 border border-cyan-800/50 shadow-glow">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resultado</p>
            <h2 className="text-xl font-bold tracking-tight text-white">{statusLabels[query.status]}</h2>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-[#1c2436] bg-[#121824] px-3 py-1 text-xs font-bold text-slate-300">
          <Coins className="h-3.5 w-3.5 text-slate-400" />
          {query.creditsCharged} crédito{query.creditsCharged === 1 ? '' : 's'}
        </span>
      </div>

      {/* Streaming State */}
      {isStreaming ? (
        <div className="mt-6 rounded-2xl border border-cyan-800/60 bg-gradient-to-r from-cyan-950/50 to-blue-950/40 p-6 shadow-glow">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
            </span>
            <p className="text-sm font-bold text-white">Acompanhando o processamento em tempo real...</p>
          </div>
          <p className="mt-1 text-xs text-cyan-300/80">
            Aguardando a resposta estruturada dos provedores parceiros.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-cyan-950">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-500 shadow-glow" />
          </div>
        </div>
      ) : null}

      {!isStreaming && !terminal ? (
        <div className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-xs text-amber-200" role="status">
          <p className="font-bold text-sm text-amber-100">Acompanhamento pausado</p>
          <p className="mt-1 text-amber-300/80">O acompanhamento foi pausado. Consulte o histórico em alguns instantes ou faça uma nova consulta.</p>
          {onRetry ? (
            <button className="mt-3 font-bold text-amber-200 underline hover:text-white" onClick={onRetry} type="button">
              Fazer nova consulta
            </button>
          ) : null}
        </div>
      ) : null}

      {query.status === 'succeeded' && query.resultExpired ? (
        <div className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-xs text-amber-200">
          <p className="font-bold text-sm text-amber-100">Resultado expirado</p>
          <p className="mt-1 text-amber-300/80">O resultado expirou do cache. Faça uma nova consulta para consultar os dados novamente.</p>
          {onRetry ? (
            <button className="mt-3 font-bold text-amber-200 underline hover:text-white" onClick={onRetry} type="button">
              Fazer nova consulta
            </button>
          ) : null}
        </div>
      ) : null}

      {query.status === 'succeeded' && query.data !== undefined && !query.resultExpired ? (
        <ResultData data={query.data} />
      ) : null}

      {query.status === 'failed' || query.status === 'refunded' ? (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-xs text-red-200">
          <p className="font-bold text-sm text-red-100">Não foi possível concluir a consulta</p>
          <p className="mt-1 leading-relaxed text-red-300">{query.errorMessage ?? 'A consulta não pôde ser concluída.'}</p>
        </div>
      ) : null}
    </section>
  );
}

function ResultData({ data }: { data: unknown }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyValue(key: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const entries = Object.entries(data);

    return (
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Dados Retornados
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            {entries.length} campo{entries.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#1c2436] bg-[#090c12]">
          <dl className="divide-y divide-[#1c2436]">
            {entries.map(([key, value]) => {
              const formatted = formatValue(value);
              const isMono =
                key.toLowerCase().includes('cpf') ||
                key.toLowerCase().includes('cnpj') ||
                key.toLowerCase().includes('id') ||
                key.toLowerCase().includes('protocolo');

              return (
                <div
                  className="group flex flex-col justify-between gap-2 p-4 transition hover:bg-[#121824] sm:flex-row sm:items-center"
                  key={key}
                >
                  <dt className="text-xs font-bold uppercase tracking-wider text-slate-400 sm:w-48 sm:shrink-0">
                    {key}
                  </dt>
                  <dd className="flex flex-1 items-center justify-between gap-3">
                    <span
                      className={`break-words text-sm text-slate-100 ${
                        isMono ? 'text-xs font-semibold text-cyan-300' : ''
                      }`}
                    >
                      {formatted}
                    </span>
                    <button
                      aria-label={`Copiar ${key}`}
                      className="opacity-0 transition group-hover:opacity-100 rounded-md p-1 text-slate-400 hover:bg-[#1c2436] hover:text-white"
                      onClick={() => void copyValue(key, formatted)}
                      title="Copiar valor"
                      type="button"
                    >
                      {copiedKey === key ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    );
  }

  return (
    <pre className="mt-6 overflow-x-auto rounded-2xl bg-[#090c12] border border-[#1c2436] p-5 text-xs leading-relaxed text-cyan-300 shadow-card">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
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
