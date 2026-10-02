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
  Sparkles,
  Layers,
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
  'cpf-cadsus': Fingerprint,
  'cpf-intelligent': Fingerprint,
  'cpf-obito': Shield,
  'cpf-parentes': Fingerprint,
  'cpf-score': Activity,
  'cpf-detran': Car,
  'sptrans-cpf': Car,
  'cpf-rais': Building2,
  'pis-pasep': Fingerprint,
  'irpf-cpf': Building2,
  'dossie-360': Shield,
  'cnpj-basico': Building2,
  'cnpj-funcionarios': Building2,
  'placa-basico': Car,
  'chassi-consulta': Car,
  'renavam-consulta': Car,
  'email-reverso': Activity,
  'telefone-reverso': Activity,
  'nome-abreviado': Fingerprint,
  'nome-completo': Fingerprint,
  'endereco-consulta': Building2,
  'dominio-whois': Activity,
  'ip-geolocalizacao': Activity,
  'logins-vazados': Shield,
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
      {/* ReUI Top Metric Triad HUD (matches top 3 cards in image.png) */}
      <section className="grid gap-4 sm:grid-cols-3">
        {/* Balance Card with E2E testid */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 transition hover:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Saldo Disponível</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/60">
              <Coins className="h-4 w-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white" data-testid="balance">
              {me.balance}
            </span>
            <span className="text-xs font-medium text-zinc-400">crédito{me.balance === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              {me.balance === 0 ? 'Saldo zerado.' : 'Pronto para consultas.'}
            </span>
            <Link
              className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition"
              href="/creditos"
            >
              Recarregar →
            </Link>
          </div>
        </div>

        {/* Modules Count */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 transition hover:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Chamadas / Conectores</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/60">
              <Cpu className="h-4 w-4 text-teal-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">{modules.length}</span>
            <span className="text-xs font-medium text-zinc-400">módulos ativos</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Bases cadastrais e veiculares</span>
            <Link
              className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition"
              href="/catalogo"
            >
              Catálogo →
            </Link>
          </div>
        </div>

        {/* Queries Count */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 transition hover:border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Consultas Recentes</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/60">
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">{queries.length}</span>
            <span className="text-xs font-medium text-zinc-400">registros</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Cache em tempo real</span>
            <Link
              className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition"
              href="#queries"
            >
              Histórico →
            </Link>
          </div>
        </div>
      </section>

      {/* Hero Welcome Bar */}
      <section className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-800/80 p-1">
              <Image
                alt="Big Eye"
                className="h-6 w-auto object-contain"
                height={32}
                src="/logo-icon.png"
                width={32}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Terminal de Operações
                </span>
                <span className="text-zinc-600">•</span>
                <AthenasStatusBadge />
              </div>

              <h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
                Olá, {displayName}
              </h1>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-400">
                Acesse a matriz de Chamadas e Consultas de dados, execute pesquisas analíticas e acompanhe o histórico investigativo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white shadow-sm"
              href="/catalogo"
            >
              <Sparkles className="h-3.5 w-3.5 text-zinc-700" />
              <span>Nova consulta</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              href="/creditos"
            >
              <Coins className="h-3.5 w-3.5 text-cyan-400" />
              <span>Ver Pacotes</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Spotlight Search Bar (ReUI search block style) */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          className="w-full rounded-xl border border-zinc-800/80 bg-zinc-900/40 py-2.5 pr-16 pl-10 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-zinc-600 focus:bg-zinc-900"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Localizar conector por nome, tag ou finalidade (ex: CPF, Dossiê, DETRAN, CNPJ)..."
          type="text"
          value={searchQuery}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="rounded border border-zinc-800 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400">
            SEARCH
          </span>
        </div>
      </section>

      {/* Module Grid (ReUI Cards) */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <h2 className="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
              Chamadas & Consultas Disponíveis
            </h2>
          </div>
          <Link
            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition"
            href="/catalogo"
          >
            <span>Ver todas as consultas</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredModules.slice(0, 6).map((module) => {
            const Icon = moduleIcons[module.slug] || Cpu;
            const hasCredits = (me?.balance ?? 0) >= module.custoCreditos;

            return (
              <div
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/60"
                key={module.slug}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 group-hover:border-zinc-700 group-hover:text-cyan-400 transition">
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    <span className="rounded-md border border-zinc-800 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                      {module.custoCreditos} cr
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-zinc-100 group-hover:text-white transition">
                    {module.nome}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">{module.slug}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                    {module.descricao}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {module.tags.map((tag) => (
                      <span
                        className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400"
                        key={tag}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-zinc-800/80 pt-3">
                  {module.implemented && hasCredits ? (
                    <Link
                      className="inline-flex w-full items-center justify-between rounded-lg bg-zinc-800/80 border border-zinc-700/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
                      href={`/consulta/${module.slug}`}
                    >
                      <span>Executar Consulta</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : module.implemented ? (
                    <Link
                      className="inline-flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                      href="/creditos"
                    >
                      <span>Obter Créditos</span>
                      <Coins className="h-3.5 w-3.5 text-cyan-400" />
                    </Link>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-500">
                      Em breve
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Queries Log Feed (ReUI Table/List block) */}
      <section className="space-y-3" id="queries">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <h2 className="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
              Registro de Atividades Recentes
            </h2>
          </div>
          <Link className="text-xs text-zinc-400 hover:text-zinc-200 transition" href="/catalogo">
            Explorar catálogo →
          </Link>
        </div>

        {queries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center">
            <Terminal className="mx-auto h-8 w-8 text-zinc-600" />
            <p className="mt-3 text-xs font-semibold text-zinc-300">Nenhuma consulta realizada ainda.</p>
            <p className="mt-1 text-[11px] text-zinc-500">Seus resultados e relatórios ficarão registrados aqui.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/30">
            <ul className="divide-y divide-zinc-800/60">
              {queries.map((query) => {
                const conf = statusColors[query.status];
                const StatusIcon = conf.icon;

                return (
                  <li
                    className="flex flex-col gap-3 px-4 py-3 transition hover:bg-zinc-800/30 sm:flex-row sm:items-center sm:justify-between"
                    key={query.id}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                        <Terminal className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <Link
                          className="text-xs font-semibold text-zinc-200 hover:text-white transition"
                          href={`/consulta/${query.moduleSlug}`}
                        >
                          {query.moduleSlug}
                        </Link>
                        <p className="text-[10px] text-zinc-500">{formatDate(query.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${conf.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                        <StatusIcon className={`h-3 w-3 ${query.status === 'running' ? 'animate-spin' : ''}`} />
                        {statusLabels[query.status]}
                      </span>

                      <Link
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition"
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

      {/* Observability Panel */}
      <AthenasApiStatusPanel />
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-xl bg-zinc-900/40" />
          <div className="h-28 rounded-xl bg-zinc-900/40" />
          <div className="h-28 rounded-xl bg-zinc-900/40" />
        </div>
        <div className="h-32 rounded-xl bg-zinc-900/40" />
      </div>
    </PageFrame>
  );
}

function ErrorPanel({ message, onRetry }: Readonly<{ message: string; onRetry?: () => void }>) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/30 p-6 text-xs text-red-300" role="alert">
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
