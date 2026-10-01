'use client';

import {
  Search,
  ArrowRight,
  Shield,
  Coins,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Fingerprint,
  Building2,
  Car,
  Activity,
  Terminal,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { MeDTOType, QueryDTOType } from '@big-eye/contracts';

import { AthenasApiStatusPanel, AthenasStatusBadge } from '../../../components/athenas-api-status';
import { apiFetchPath, type ModuleDTOType } from '../../../lib/api';

const statusLabels: Record<QueryDTOType['status'], string> = {
  pending: 'Na fila',
  running: 'Processando',
  succeeded: 'Concluída',
  failed: 'Falhou',
  refunded: 'Reembolsada',
};

const statusColors: Record<QueryDTOType['status'], { badge: string; dot: string; icon: typeof CheckCircle2 }> = {
  pending: {
    badge: 'border-amber-800/50 bg-amber-950/40 text-amber-300',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  running: {
    badge: 'border-cyan-800/50 bg-cyan-950/40 text-cyan-300',
    dot: 'bg-cyan-400 animate-pulse',
    icon: Loader2,
  },
  succeeded: {
    badge: 'border-emerald-800/50 bg-emerald-950/40 text-emerald-300',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  failed: {
    badge: 'border-red-800/50 bg-red-950/40 text-red-300',
    dot: 'bg-red-400',
    icon: XCircle,
  },
  refunded: {
    badge: 'border-sky-800/50 bg-sky-950/40 text-sky-300',
    dot: 'bg-sky-400',
    icon: RotateCcw,
  },
};

const moduleIcons: Record<string, typeof Fingerprint> = {
  'cpf-basico': Fingerprint,
  'cpf-completo': Fingerprint,
  'dossie-360': Shield,
  'cnh-detran': Car,
  'cnpj-receita': Building2,
  'veiculo-placa': Car,
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
  const [modules, setModules] = useState<ModuleDTOType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const [profile, recentQueries, catalog] = await Promise.all([
          apiFetchPath('/me'),
          apiFetchPath('/queries'),
          apiFetchPath('/modules'),
        ]);

        if (active) {
          setMe(profile);
          setQueries(recentQueries.slice(0, 6));
          setModules(catalog);
        }
      } catch {
        if (active) {
          setError('Não foi possível carregar seu painel de operações.');
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

  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.nome.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        m.descricao.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [modules, searchQuery]);

  if (isLoading) {
    return <LoadingPanel />;
  }

  if (error || !me) {
    return (
      <PageFrame>
        <ErrorPanel message={error ?? 'Falha ao carregar perfil do operador.'} onRetry={() => window.location.reload()} />
      </PageFrame>
    );
  }

  const displayName = me.name || me.email.split('@')[0];

  return (
    <PageFrame>
      {/* Command Center Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[#1a2233] bg-gradient-to-r from-[#0d121c] via-[#0f1422] to-[#0a0e17] p-6 sm:p-8 shadow-card">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-48 w-48 rounded-full bg-teal-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-[#121826]/90 p-1.5 shadow-glow">
              <Image
                alt="Big Eye"
                className="h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                height={40}
                src="/logo-icon.png"
                width={40}
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                <span className="text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
                  Terminal de Operações
                </span>
                <span className="text-slate-600">•</span>
                <AthenasStatusBadge />
              </div>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Olá, {displayName}
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">
                Acesse a matriz de Chamadas/Consultas de dados, execute pesquisas analíticas e acompanhe o histórico investigativo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-3 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500 hover:shadow-glow-teal"
              href="/catalogo"
            >
              <Search className="h-4 w-4" />
              <span>Nova consulta</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-[#232f48] bg-[#121929] px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/50 hover:bg-[#162035] hover:text-white"
              href="/creditos"
            >
              <Coins className="h-4 w-4 text-cyan-400" />
              <span>Ver Pacotes</span>
            </Link>
          </div>
        </div>
      </section>

      <AthenasApiStatusPanel />

      {/* Metrics Triad HUD */}
      <section className="grid gap-4 sm:grid-cols-3">
        {/* Balance Card with E2E testid */}
        <div className="rounded-2xl border border-cyan-900/40 bg-gradient-to-br from-[#0e1422] to-[#0a0e18] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Saldo Disponível</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-black text-white" data-testid="balance">
              {me.balance}
            </span>
            <span className="text-xs font-medium text-slate-400">crédito{me.balance === 1 ? '' : 's'}</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {me.balance === 0 ? 'Saldo zerado. Recarregue para consultar.' : 'Disponível para consultas imediatas.'}
          </p>
        </div>

        {/* Modules Count */}
        <div className="rounded-2xl border border-[#1a2233] bg-[#0d111a] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Chamadas/Consultas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-950/80 text-teal-400 border border-teal-800/40">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{modules.length}</span>
            <span className="text-xs font-medium text-slate-400">Chamadas/Consultas ativas</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Bases cadastrais, veiculares e societárias.</p>
        </div>

        {/* Queries Count */}
        <div className="rounded-2xl border border-[#1a2233] bg-[#0d111a] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Consultas Recentes</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950/80 text-blue-400 border border-blue-800/40">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{queries.length}</span>
            <span className="text-xs font-medium text-slate-400">registros</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Acompanhamento e cache em tempo real.</p>
        </div>
      </section>

      {/* Spotlight Command Bar */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-cyan-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          className="w-full rounded-2xl border border-[#1c2436] bg-[#0d111a] py-3.5 pr-16 pl-11 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:bg-[#101522] focus:ring-2 focus:ring-cyan-500/20"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Localizar conector por nome, tag ou finalidade (ex: CPF, Dossiê, DETRAN, CNPJ)..."
          type="text"
          value={searchQuery}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
          <span className="rounded-md border border-[#2a364d] bg-[#141b29] px-2 py-0.5 text-[10px] text-slate-400">
            SEARCH
          </span>
        </div>
      </section>

      {/* Module Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-cyan-500" />
            <h2 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
              Chamadas/Consultas Disponíveis
            </h2>
          </div>
          <Link
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            href="/catalogo"
          >
            <span>Ver todas as Chamadas/Consultas</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredModules.slice(0, 6).map((module) => {
            const Icon = moduleIcons[module.slug] || Cpu;
            const hasCredits = (me?.balance ?? 0) >= module.custoCreditos;

            return (
              <div
                className="group relative flex flex-col justify-between rounded-2xl border border-[#1a2233] bg-[#0c1018] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50 hover:bg-[#0f1422] hover:shadow-card-hover"
                key={module.slug}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e293f] bg-[#121826] text-cyan-400 group-hover:border-cyan-500/60 group-hover:shadow-glow">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full border border-cyan-900/50 bg-cyan-950/40 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                        {module.custoCreditos} cr
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-3.5 text-sm font-bold text-white group-hover:text-cyan-300 transition">
                    {module.nome}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">{module.slug}</p>
                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
                    {module.descricao}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {module.tags.map((tag) => (
                      <span
                        className="rounded-md border border-[#1a2436] bg-[#0f1522] px-2 py-0.5 text-[10px] font-medium text-slate-400"
                        key={tag}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 border-t border-[#172030] pt-3">
                  {module.implemented && hasCredits ? (
                    <Link
                      className="inline-flex w-full items-center justify-between rounded-xl bg-cyan-950/60 border border-cyan-800/40 px-3 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-600 hover:text-white hover:border-cyan-500"
                      href={`/consulta/${module.slug}`}
                    >
                      <span>Executar Consulta</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : module.implemented ? (
                    <Link
                      className="inline-flex w-full items-center justify-between rounded-xl border border-[#2a364d] bg-[#121826] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
                      href="/creditos"
                    >
                      <span>Obter Créditos</span>
                      <Coins className="h-3.5 w-3.5 text-cyan-400" />
                    </Link>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center rounded-xl bg-[#10141f] px-3 py-2 text-xs font-medium text-slate-500">
                      Em breve
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Queries Log Feed */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-cyan-500" />
            <h2 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
              Registro de Atividades Recentes
            </h2>
          </div>
          <Link className="text-xs text-slate-400 hover:text-cyan-400" href="/catalogo">
            Explorar catálogo →
          </Link>
        </div>

        {queries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1e293f] bg-[#0c1018] p-10 text-center">
            <Terminal className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-xs font-bold text-slate-300">Nenhuma consulta realizada ainda.</p>
            <p className="mt-1 text-[11px] text-slate-500">Seus resultados e relatórios ficarão registrados aqui.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#1a2233] bg-[#0c1018] shadow-card">
            <ul className="divide-y divide-[#172030]">
              {queries.map((query) => {
                const conf = statusColors[query.status];
                const StatusIcon = conf.icon;

                return (
                  <li
                    className="flex flex-col gap-3 px-5 py-3.5 transition hover:bg-[#101522] sm:flex-row sm:items-center sm:justify-between"
                    key={query.id}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#121826] text-slate-400 border border-[#1e293f]">
                        <Terminal className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <Link
                          className="text-xs font-bold text-white hover:text-cyan-300"
                          href={`/consulta/${query.moduleSlug}`}
                        >
                          {query.moduleSlug}
                        </Link>
                        <p className="text-[10px] text-slate-500">{formatDate(query.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${conf.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                        <StatusIcon className={`h-3 w-3 ${query.status === 'running' ? 'animate-spin' : ''}`} />
                        {statusLabels[query.status]}
                      </span>

                      <Link
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-[#182030] hover:text-white"
                        href={`/consulta/${query.moduleSlug}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </PageFrame>
  );
}

function PageFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="space-y-6">{children}</div>;
}

function LoadingPanel() {
  return (
    <PageFrame>
      <div className="space-y-4 animate-pulse">
        <div className="h-32 rounded-2xl bg-[#0d121c]" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-2xl bg-[#0d121c]" />
          <div className="h-28 rounded-2xl bg-[#0d121c]" />
          <div className="h-28 rounded-2xl bg-[#0d121c]" />
        </div>
      </div>
    </PageFrame>
  );
}

function ErrorPanel({ message, onRetry }: Readonly<{ message: string; onRetry?: () => void }>) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-900/60 bg-red-950/30 p-6 text-xs text-red-300" role="alert">
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
      <div>
        <p className="font-bold text-sm text-red-200">Falha de comunicação</p>
        <p className="mt-1">{message}</p>
        {onRetry ? (
          <button className="mt-3 font-bold underline hover:text-white" onClick={onRetry} type="button">
            Tentar novamente
          </button>
        ) : null}
      </div>
    </div>
  );
}
