'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Receipt,
} from 'lucide-react';

import type { MeDTOType, PackageDTOType, TransactionDTOType } from '@big-eye/contracts';

import { BuyCredits } from '../../../components/buy-credits';
import { apiFetch, apiFetchPath } from '../../../lib/api';

const transactionConfig: Record<
  TransactionDTOType['type'],
  { label: string; icon: typeof ArrowDownLeft; color: string; badge: string }
> = {
  signup_bonus: {
    label: 'Bônus de cadastro',
    icon: Gift,
    color: 'text-violet-400 bg-violet-950/60 border border-violet-800/40',
    badge: 'text-violet-300',
  },
  purchase: {
    label: 'Compra de créditos',
    icon: ArrowDownLeft,
    color: 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40',
    badge: 'text-emerald-300',
  },
  consume: {
    label: 'Consulta realizada',
    icon: ArrowUpRight,
    color: 'text-slate-400 bg-[#181926] border border-[#2a2d40]',
    badge: 'text-slate-300',
  },
  refund: {
    label: 'Reembolso de consulta',
    icon: RotateCcw,
    color: 'text-sky-400 bg-sky-950/60 border border-sky-800/40',
    badge: 'text-sky-300',
  },
  admin_adjust: {
    label: 'Ajuste administrativo',
    icon: SlidersHorizontal,
    color: 'text-amber-400 bg-amber-950/60 border border-amber-800/40',
    badge: 'text-amber-300',
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
      setError('Não foi possível carregar sua carteira agora.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      setError('Não foi possível carregar mais lançamentos.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function refreshAfterPayment(): Promise<void> {
    await load();
  }

  if (isLoading) {
    return (
      <CreditsFrame>
        <div className="space-y-4 animate-pulse">
          <div className="h-10 w-48 rounded-xl bg-[#12131d]" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-96 rounded-2xl bg-[#12131d]" />
            <div className="h-96 rounded-2xl bg-[#12131d]" />
          </div>
        </div>
      </CreditsFrame>
    );
  }

  if (error && !me) {
    return (
      <CreditsFrame>
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 text-sm text-red-300">
          <p>{error}</p>
          <button className="mt-3 text-xs font-semibold underline" onClick={() => window.location.reload()} type="button">
            Tentar novamente
          </button>
        </div>
      </CreditsFrame>
    );
  }

  return (
    <CreditsFrame>
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Créditos & Extrato
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Adicione créditos à sua carteira para continuar desbloqueando consultas.
          </p>
        </div>

        {/* Balance Card Header */}
        <div className="flex items-center gap-3 rounded-2xl border border-[#1e202f] bg-[#12131d] p-4 shadow-card">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-950/60 text-violet-400 border border-violet-800/40">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Saldo disponível</p>
            <p className="text-2xl font-black text-white">{me?.balance ?? 0}</p>
          </div>
        </div>
      </section>

      {/* Main Grid: Buy Credits + Statement */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <BuyCredits onPaymentPaid={refreshAfterPayment} packages={packages} />
        <TransactionStatement
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          transactions={transactions}
        />
      </div>

      {error ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-8">
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-violet-400"
          href="/catalogo"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>← Voltar ao catálogo</span>
        </Link>
      </div>
    </CreditsFrame>
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
  return (
    <section className="rounded-2xl border border-[#1e202f] bg-[#12131d] p-6 shadow-card sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-violet-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Extrato</p>
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
            Movimentações
          </h2>
        </div>
        <span className="rounded-full border border-[#2a2d40] bg-[#181926] px-2.5 py-0.5 text-xs font-semibold text-slate-400">
          {transactions.length} registros
        </span>
      </div>

      {transactions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#1e202f] bg-[#181926] p-8 text-center">
          <p className="text-xs font-medium text-slate-300">Ainda não há movimentações para exibir.</p>
          <p className="mt-1 text-[11px] text-slate-500">Suas compras e consultas aparecerão aqui.</p>
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-[#1e202f]">
            {transactions.map((transaction) => {
              const conf = transactionConfig[transaction.type] ?? {
                label: 'Movimentação',
                icon: Coins,
                color: 'text-slate-400 bg-[#181926] border border-[#2a2d40]',
                badge: 'text-slate-300',
              };
              const Icon = conf.icon;

              return (
                <li
                  className="flex items-start justify-between gap-4 py-3.5 transition first:pt-0 last:pb-0 hover:bg-[#151724]"
                  key={transaction.id}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${conf.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{conf.label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(transaction.createdAt)}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-xs font-extrabold ${
                        transaction.amount >= 0 ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {transaction.amount > 0 ? '+' : ''}
                      {transaction.amount}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">saldo {transaction.balanceAfter}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <button
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2a2d40] bg-[#181926] py-2.5 px-4 text-xs font-semibold text-slate-300 shadow-xs transition hover:bg-[#202234] hover:text-white disabled:opacity-60"
              disabled={isLoadingMore}
              onClick={() => void onLoadMore()}
              type="button"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Carregando...</span>
                </>
              ) : (
                <span>Carregar mais movimentações</span>
              )}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function CreditsFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="space-y-6">{children}</div>;
}
