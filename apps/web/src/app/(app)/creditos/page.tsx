'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { MeDTOType, PackageDTOType, TransactionDTOType } from '@big-eye/contracts';

import { BuyCredits } from '../../../components/buy-credits';
import { apiFetch, apiFetchPath } from '../../../lib/api';

const transactionLabels: Record<TransactionDTOType['type'], string> = {
  signup_bonus: 'Bônus de cadastro',
  purchase: 'Compra de créditos',
  consume: 'Consulta realizada',
  refund: 'Reembolso de consulta',
  admin_adjust: 'Ajuste administrativo',
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
    return <CreditsFrame><div className="h-8 w-48 animate-pulse rounded bg-slate-200" /></CreditsFrame>;
  }

  if (error && !me) {
    return <CreditsFrame><ErrorPanel message={error} onRetry={() => window.location.reload()} /></CreditsFrame>;
  }

  return (
    <CreditsFrame>
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-petrol-600">Carteira</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Créditos e extrato</h1>
          <p className="mt-2 max-w-xl text-slate-600">Acompanhe seu saldo e compre créditos para continuar consultando.</p>
        </div>
        <div className="rounded-2xl border border-petrol-100 bg-petrol-50 px-6 py-4">
          <p className="text-sm font-medium text-petrol-800">Saldo disponível</p>
          <p className="mt-1 text-3xl font-semibold text-petrol-950">{me?.balance ?? 0}</p>
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <BuyCredits onPaymentPaid={refreshAfterPayment} packages={packages} />
        <TransactionStatement hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} transactions={transactions} />
      </div>
      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p> : null}
      <Link className="mt-8 inline-block text-sm font-semibold text-petrol-700 hover:text-petrol-800" href="/catalogo">← Voltar ao catálogo</Link>
    </CreditsFrame>
  );
}

function TransactionStatement({ transactions, hasMore, isLoadingMore, onLoadMore }: { transactions: TransactionDTOType[]; hasMore: boolean; isLoadingMore: boolean; onLoadMore: () => Promise<void> }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol-600">Extrato</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Movimentações recentes</h2>
      </div>
      {transactions.length === 0 ? (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Ainda não há movimentações para exibir.</p>
      ) : (
        <>
          <ul className="mt-5 divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <li className="flex items-start justify-between gap-4 py-3 first:pt-0" key={transaction.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{transactionLabels[transaction.type]}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">saldo {transaction.balanceAfter}</p>
                </div>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <button className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={isLoadingMore} onClick={() => void onLoadMore()} type="button">
              {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function CreditsFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>;
}

function ErrorPanel({ message, onRetry }: Readonly<{ message: string; onRetry?: () => void }>) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button className="mt-3 font-semibold underline" onClick={onRetry} type="button">
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
