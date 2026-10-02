'use client';

import { Activity, AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RefreshCw, Server, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { AthenasEndpointStatusDTOType } from '@big-eye/contracts';

import { useAthenasStatus } from '../lib/use-athenas-status';

import { OrbLoader } from './orb-loader';

type StatusKey = 'operational' | 'partial_outage' | 'major_outage' | 'idle';
type EndpointStatusKey = AthenasEndpointStatusDTOType['status'];

const overallStatus: Record<StatusKey, { label: string; shortLabel: string; tone: string; dot: string }> = {
  operational: {
    label: 'Operacional',
    shortLabel: 'Operacional',
    tone: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300',
    dot: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
  },
  partial_outage: {
    label: 'Instabilidade parcial',
    shortLabel: 'Instabilidade',
    tone: 'border-amber-800/60 bg-amber-950/40 text-amber-300',
    dot: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
  },
  major_outage: {
    label: 'Indisponibilidade grave',
    shortLabel: 'Fora do ar',
    tone: 'border-red-800/60 bg-red-950/40 text-red-300',
    dot: 'bg-red-400 shadow-[0_0_8px_#f87171]',
  },
  idle: {
    label: 'Sem tráfego recente',
    shortLabel: 'Sem tráfego',
    tone: 'border-slate-700 bg-slate-900/70 text-slate-300',
    dot: 'bg-slate-400',
  },
};

const endpointStatus: Record<EndpointStatusKey, { label: string; tone: string }> = {
  operational: {
    label: 'Operacional',
    tone: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300',
  },
  degraded: {
    label: 'Degradado',
    tone: 'border-amber-800/60 bg-amber-950/40 text-amber-300',
  },
  unavailable: {
    label: 'Indisponível',
    tone: 'border-red-800/60 bg-red-950/40 text-red-300',
  },
  idle: {
    label: 'Sem tráfego',
    tone: 'border-slate-700 bg-slate-900/70 text-slate-300',
  },
};

function formatPercent(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function QueryStatusBadge({ compact = false }: Readonly<{ compact?: boolean }>) {
  const status = useAthenasStatus();

  if (status.isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-900/60 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-semibold text-cyan-300">
        <LoaderCircle className="h-3 w-3 animate-spin" />
        Consultando Big Eye
      </span>
    );
  }

  if (status.isError && !status.data) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Status indisponível
      </span>
    );
  }

  if (status.data!.status === 'disabled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Rede Big Eye desativada
      </span>
    );
  }

  const currentStatus = overallStatus[status.data!.status];
  const label = status.isError
    ? 'Leitura desatualizada'
    : compact
      ? currentStatus.shortLabel
      : currentStatus.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.isError ? 'border-amber-800/60 bg-amber-950/40 text-amber-300' : currentStatus.tone}`}
      title={status.isError ? 'A atualização falhou; o painel mostra a última leitura recebida.' : currentStatus.label}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status.isError ? 'bg-amber-400' : currentStatus.dot}`} />
      {label}
    </span>
  );
}

export function AthenasStatusBadge() {
  return (
    <Link
      className="inline-flex rounded-full outline-none transition hover:brightness-125 focus-visible:ring-2 focus-visible:ring-cyan-400"
      href="/dashboard#api-status"
      title="Ver detalhes do status da rede Big Eye"
    >
      <QueryStatusBadge compact />
    </Link>
  );
}

export function AthenasStatusSidebar({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  const status = useAthenasStatus({ poll: true });
  const uptime = status.data?.status === 'disabled' ? null : status.data?.uptime['24h'];
  const lastKnownValue = uptime === null || uptime === undefined ? null : formatPercent(uptime);

  let summary = 'Consultando';
  let dot = 'bg-cyan-400 animate-pulse';
  if (status.isError) {
    summary = status.data ? 'Desatualizado' : 'Indisponível';
    dot = status.data ? 'bg-amber-400' : 'bg-slate-500';
  } else if (!status.isPending && status.data) {
    if (status.data.status === 'disabled') {
      summary = 'Desativada';
      dot = 'bg-slate-500';
    } else {
      const statusLabel = overallStatus[status.data.status].shortLabel;
      summary = status.data.status === 'operational' && lastKnownValue
        ? `${statusLabel} · ${lastKnownValue}`
        : statusLabel;
      dot = overallStatus[status.data.status].dot;
    }
  }

  return (
    <Link
      className="mb-4 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-[11px] transition hover:border-zinc-700 hover:bg-zinc-800/60"
      href="/dashboard#api-status"
      onClick={onNavigate}
      title={status.isError && status.data ? 'A atualização falhou; exibindo a última leitura.' : 'Ver status da rede Big Eye'}
    >
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="font-medium text-zinc-300">API Big Eye</span>
      </span>
      <span className={`text-[10px] font-semibold ${status.isError ? 'text-amber-300' : 'text-emerald-400'}`}>
        {summary}
      </span>
    </Link>
  );
}

export function AthenasApiStatusPanel() {
  const status = useAthenasStatus();
  const [expanded, setExpanded] = useState(true);
  const data = status.data;
  const connectedData = data?.status === 'disabled' ? undefined : data;

  return (
    <section
      aria-labelledby="services-api-status-title"
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 sm:p-6"
      id="api-status"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800 text-zinc-300">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold tracking-wide text-white" id="services-api-status-title">
              Status da Rede Big Eye
            </h2>
            <QueryStatusBadge />
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-400">
            {connectedData?.description ?? 'Disponibilidade e uptime dos endpoints usados nas consultas.'}
          </p>
        </div>

        <button
          aria-label="Atualizar status da rede Big Eye"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:cursor-wait disabled:opacity-60"
          disabled={status.isFetching}
          onClick={() => void status.refetch()}
          type="button"
        >
          {status.isFetching ? (
            <OrbLoader color="#22d3ee" size={20} state="working" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Atualizar
        </button>
      </div>

      {status.isError ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-[11px] text-amber-200" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p>
            {data
              ? 'Não foi possível atualizar. Os dados abaixo são da última leitura recebida.'
              : 'Não foi possível consultar o status. Verifique a conexão e a configuração da rede Big Eye.'}
          </p>
        </div>
      ) : null}

      {!data ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-xs text-zinc-400" role={status.isError ? 'alert' : 'status'}>
          {status.isError ? <XCircle className="h-4 w-4 text-zinc-500" /> : <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />}
          {status.isError ? 'Status não disponível no momento.' : 'Consultando a disponibilidade dos endpoints…'}
        </div>
      ) : data.status === 'disabled' ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-xs text-zinc-300" role="status">
          <Clock3 className="h-4 w-4 shrink-0 text-zinc-400" />
          A integração com a rede de dados está desativada neste ambiente. Ative os serviços da Big Eye para consultar a disponibilidade dos endpoints.
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {([
              ['24 horas', data.uptime['24h']],
              ['7 dias', data.uptime['7d']],
              ['31 dias', data.uptime['31d']],
            ] as const).map(([period, value]) => (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3" key={period}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Uptime · {period}</p>
                <p className="mt-1 text-xl font-bold text-white">{formatPercent(value)}</p>
              </div>
            ))}
          </div>

          <div aria-label="Resumo dos endpoints" className="mt-3 flex flex-wrap gap-2">
            <SummaryCount label="Operacionais" count={data.summary.operational} tone="text-emerald-300 border-emerald-900/50 bg-emerald-950/30" />
            <SummaryCount label="Degradados" count={data.summary.degraded} tone="text-amber-300 border-amber-900/50 bg-amber-950/30" />
            <SummaryCount label="Indisponíveis" count={data.summary.unavailable} tone="text-red-300 border-red-900/50 bg-red-950/30" />
            <SummaryCount label="Sem tráfego" count={data.summary.idle} tone="text-zinc-300 border-zinc-700 bg-zinc-800/60" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] text-zinc-300">
              <Server className="h-3 w-3" />
              {data.summary.total} endpoints
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Disponibilidade por endpoint</h3>
                <p className="mt-0.5 text-[10px] text-zinc-500">Uptime de 24 horas e latência média.</p>
              </div>
              <button
                aria-expanded={expanded}
                className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 transition"
                onClick={() => setExpanded((value) => !value)}
                type="button"
              >
                {expanded ? 'Recolher' : 'Expandir'}
              </button>
            </div>

            {expanded ? (
              data.endpoints.length > 0 ? (
                <div className="grid max-h-[28rem] gap-2 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.endpoints.map((endpoint) => (
                    <article className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3" key={endpoint.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-semibold text-zinc-200" title={endpoint.name}>
                            {endpoint.name}
                          </h4>
                          <p className="mt-0.5 truncate text-[10px] text-zinc-500" title={`${endpoint.group} · ${endpoint.path}`}>
                            {endpoint.group} · {endpoint.path}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${endpointStatus[endpoint.status].tone}`}>
                          {endpointStatus[endpoint.status].label}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[10px]">
                        <span className="text-zinc-500">
                          Uptime 24h <strong className="ml-1 text-zinc-300">{formatPercent(endpoint.uptime['24h'])}</strong>
                        </span>
                        <span className="text-zinc-500">
                          Latência <strong className="ml-1 text-zinc-300">{endpoint.avgResponseMs === null ? '—' : `${Math.round(endpoint.avgResponseMs)} ms`}</strong>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-xs text-slate-500">A resposta não trouxe endpoints para exibir.</p>
              )
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-1 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5">
              {data.status === 'operational' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Clock3 className="h-3 w-3" />}
              Leitura gerada em {formatTimestamp(data.generatedAt)}{data.cached ? ' · resposta em cache' : ''}
            </span>
            <span>Atualização automática a cada 60 s · sem consumo de créditos</span>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryCount({ label, count, tone }: Readonly<{ label: string; count: number; tone: string }>) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${tone}`}>
      <span className="font-bold">{count}</span>
      {label}
    </span>
  );
}
