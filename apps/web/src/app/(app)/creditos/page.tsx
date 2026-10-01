'use client';

import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Zap,
  Receipt,
  ArrowDown,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';

import type { MeDTOType, PackageDTOType, TransactionDTOType } from '@big-eye/contracts';

import { BuyCredits } from '../../../components/buy-credits';
import { OrbLoader } from '../../../components/orb-loader';
import { apiFetch, apiFetchPath } from '../../../lib/api';

const transactionConfig: Record<
  TransactionDTOType['type'],
  { label: string; icon: typeof ArrowDownLeft; color: string; badge: string; isCredit: boolean }
> = {
  signup_bonus: {
    label: 'Bônus de cadastro',
    icon: Gift,
    color: 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/40',
    badge: 'text-cyan-300 bg-cyan-950/40',
    isCredit: true,
  },
  purchase: {
    label: 'Recarga de saldo',
    icon: ArrowDownLeft,
    color: 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40',
    badge: 'text-emerald-300 bg-emerald-950/40',
    isCredit: true,
  },
  consume: {
    label: 'Consulta realizada',
    icon: ArrowUpRight,
    color: 'text-slate-400 bg-[#121824] border border-[#1c2436]',
    badge: 'text-slate-300 bg-[#121824]',
    isCredit: false,
  },
  refund: {
    label: 'Reembolso de consulta',
    icon: RotateCcw,
    color: 'text-sky-400 bg-sky-950/60 border border-sky-800/40',
    badge: 'text-sky-300 bg-sky-950/40',
    isCredit: true,
  },
  admin_adjust: {
    label: 'Ajuste administrativo',
    icon: SlidersHorizontal,
    color: 'text-amber-400 bg-amber-950/60 border border-amber-800/40',
    badge: 'text-amber-300 bg-amber-950/40',
    isCredit: true,
  },
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function CreditsPage() {
  const [me, setMe] = useState<MeDTOType>();
  const [packages, setPackages] = useState<PackageDTOType[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTOType[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  async function load(firstPage = true): Promise<void> {
    try {
      const [profile, availablePackages, firstTransactions] = await Promise.all([
        apiFetchPath('/me'),
        apiFetchPath('/packages'),
        apiFetchPath('/credits/transactions'),
      ]);
      setMe(profile);
      setPackages(availablePackages);
      if (firstPage) {
        setTransactions(firstTransactions);
        setHasMore(firstTransactions.length === 20);
      }
    } catch {
      setError('Não foi possível carregar as informações da sua carteira no momento.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRefresh(): Promise<void> {
    setIsRefreshing(true);
    await load();
  }

  async function loadMore(): Promise<void> {
    const cursor = transactions.at(-1)?.id;
    if (!cursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const nextPage = await apiFetch<TransactionDTOType[]>(`/credits/transactions?limit=20&cursor=${encodeURIComponent(cursor)}`);
      setTransactions((current) => [...current, ...nextPage]);
      setHasMore(nextPage.length === 20);
    } catch {
      setError('Não foi possível carregar mais movimentações.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function refreshAfterPayment(): Promise<void> {
    await load();
  }

  function scrollToStatement(): void {
    const element = document.getElementById('extrato-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-[#0d121c]" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-2xl bg-[#0d121c]" />
          <div className="h-28 rounded-2xl bg-[#0d121c]" />
          <div className="h-28 rounded-2xl bg-[#0d121c]" />
        </div>
        <div className="h-96 rounded-2xl bg-[#0d121c] w-full" />
        <div className="h-80 rounded-2xl bg-[#0d121c] w-full" />
      </div>
    );
  }

  if (error && !me) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 text-sm text-red-300">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p>{error}</p>
        </div>
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-900/60 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              Operador &bull; Faturamento &amp; Saldo
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Carteira &amp; Créditos
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Adquira créditos avulsos sem mensalidade para executar buscas e investigações profundas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[#1c2436] bg-[#0d121c] px-3.5 py-2 text-xs font-medium text-slate-300 shadow-sm transition hover:border-[#2a3752] hover:bg-[#121824] hover:text-white disabled:opacity-50"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
            title="Atualizar saldo e histórico"
            type="button"
          >
            {isRefreshing ? (
              <OrbLoader color="#22d3ee" size={20} state="working" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
            )}
            <span>Atualizar</span>
          </button>

          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#1c2436] bg-[#0d121c] px-3.5 py-2 text-xs font-medium text-slate-300 shadow-sm transition hover:border-[#2a3752] hover:bg-[#121824] hover:text-white"
            onClick={scrollToStatement}
            type="button"
          >
            <ArrowDown className="h-3.5 w-3.5 text-slate-400" />
            <span>Ver Extrato ({transactions.length})</span>
          </button>

          <Link
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-800/40 bg-cyan-950/30 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-900/40 hover:text-white"
            href="/catalogo"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Ir para o Catálogo</span>
          </Link>
        </div>
      </section>

      {/* KPI / Balance Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Balance */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-[#111927] to-[#0b1019] p-5 shadow-glow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              Saldo Disponível
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-700/50 bg-cyan-950/80 text-cyan-400 shadow-glow">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {me?.balance?.toLocaleString('pt-BR') ?? 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">créditos</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Pronto para consumo imediato em qualquer módulo do sistema.
          </p>
        </div>

        {/* Card 2: No Expiration */}
        <div className="rounded-2xl border border-[#1c2436] bg-[#0c101a] p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Validade dos Créditos
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-800/40 bg-teal-950/60 text-teal-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-white sm:text-2xl">
              Sem Expiração
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Seus créditos nunca expiram. Use no seu próprio ritmo, sem taxas ocultas.
          </p>
        </div>

        {/* Card 3: Pix instantáneo */}
        <div className="rounded-2xl border border-[#1c2436] bg-[#0c101a] p-5 shadow-card sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Aprovação Financeira
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/40 bg-emerald-950/60 text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-white sm:text-2xl">
              Liberação em 3s
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Pagamentos via Pix são conciliados automaticamente pelo Banco Central.
          </p>
        </div>
      </section>

      {/* Planos & Pacotes de Créditos: Full Width with 4 packages in a single row */}
      <section className="w-full">
        <BuyCredits onPaymentPaid={refreshAfterPayment} packages={packages} />
      </section>

      {/* Extrato & Histórico de Movimentações: Full Width below */}
      <section className="w-full pt-2" id="extrato-section">
        <TransactionStatement
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          transactions={transactions}
        />
      </section>

      {error ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function TransactionStatement({
  transactions,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  transactions: TransactionDTOType[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  const filteredTransactions = useMemo(() => {
    if (filter === 'in') {
      return transactions.filter((t) => t.amount > 0);
    }
    if (filter === 'out') {
      return transactions.filter((t) => t.amount < 0);
    }
    return transactions;
  }, [transactions, filter]);

  return (
    <section className="flex flex-col rounded-2xl border border-[#1c2436] bg-[#0c101a] p-5 shadow-card sm:p-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#1c2436] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Extrato &amp; Histórico
            </p>
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Movimentações da Carteira
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Acompanhe em detalhes cada recarga, bônus e consumo de consultas realizadas.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-xl bg-[#090d15] p-1 border border-[#1c2436]/80 text-xs">
            <button
              className={`rounded-lg px-3.5 py-1.5 font-semibold transition ${
                filter === 'all'
                  ? 'bg-[#161d2d] text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setFilter('all')}
              type="button"
            >
              Todas ({transactions.length})
            </button>
            <button
              className={`rounded-lg px-3.5 py-1.5 font-semibold transition ${
                filter === 'in'
                  ? 'bg-[#161d2d] text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setFilter('in')}
              type="button"
            >
              Entradas (+)
            </button>
            <button
              className={`rounded-lg px-3.5 py-1.5 font-semibold transition ${
                filter === 'out'
                  ? 'bg-[#161d2d] text-slate-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setFilter('out')}
              type="button"
            >
              Saídas (-)
            </button>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-[#1c2436] bg-[#10141f] p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#161d2d] text-slate-500 mb-3 border border-[#20293d]">
            <Receipt className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-slate-300">
            {filter === 'all'
              ? 'Nenhuma movimentação registrada na sua carteira.'
              : filter === 'in'
              ? 'Nenhuma entrada de créditos encontrada.'
              : 'Nenhuma saída de créditos encontrada.'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Suas recargas, bônus e consultas aparecerão listadas aqui em ordem cronológica.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <ul className="divide-y divide-[#1c2436]/60">
            {filteredTransactions.map((transaction) => {
              const conf = transactionConfig[transaction.type] ?? {
                label: 'Movimentação',
                icon: Coins,
                color: 'text-slate-400 bg-[#121824] border border-[#1c2436]',
                badge: 'text-slate-300 bg-[#121824]',
                isCredit: transaction.amount > 0,
              };
              const Icon = conf.icon;
              const isPositive = transaction.amount > 0;

              return (
                <li
                  className="flex items-center justify-between gap-4 py-3.5 transition hover:bg-[#121824]/50 rounded-xl px-3"
                  key={transaction.id}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${conf.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-bold text-white">
                          {conf.label}
                        </p>
                      </div>
                      {transaction.description && transaction.description !== conf.label ? (
                        <p className="truncate text-[11px] text-slate-400">
                          {transaction.description}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {formatDate(transaction.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-black ${
                        isPositive ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {transaction.amount.toLocaleString('pt-BR')}
                    </p>
                    <span className="mt-1 inline-block rounded-md border border-[#1c2436] bg-[#0a0e16] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      saldo pós-operação: {transaction.balanceAfter.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <button
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#1c2436] bg-[#10141f] py-3 px-4 text-xs font-semibold text-slate-300 shadow-sm transition hover:border-[#2a3752] hover:bg-[#161d2d] hover:text-white disabled:opacity-60"
              disabled={isLoadingMore}
              onClick={() => void onLoadMore()}
              type="button"
            >
              {isLoadingMore ? (
                <>
                  <OrbLoader color="#22d3ee" size={20} state="working" />
                  <span>Carregando mais...</span>
                </>
              ) : (
                <span>Carregar mais movimentações</span>
              )}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
