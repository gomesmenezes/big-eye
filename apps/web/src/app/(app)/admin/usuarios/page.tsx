'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { AdminError, AdminLoading, AdminPage, AdminStatus, adminErrorMessage } from '../../../../components/admin/admin-shell';
import {
  formatDate,
  getBalance,
  getNumber,
  getText,
  isRecord,
  readItems,
  readNextCursor,
  type AdminUser,
  type AdminUserDetail,
} from '../../../../components/admin/admin-types';
import { OrbLoader } from '../../../../components/orb-loader';
import { apiFetch } from '../../../../lib/api';

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [selected, setSelected] = useState<AdminUserDetail>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function loadUsers(query = search, cursor?: string, append = false): Promise<void> {
    setIsLoading(!append);
    setIsLoadingMore(append);
    setError(undefined);

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (cursor) params.set('cursor', cursor);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch<unknown>(`/admin/users${suffix}`);
      const items = readItems<AdminUser>(response, ['items', 'users', 'data']);
      setUsers((current) => append ? [...current, ...items] : items);
      setNextCursor(readNextCursor(response));
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível carregar os usuários.'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  async function openUser(id: string): Promise<void> {
    setIsDetailLoading(true);
    setError(undefined);

    try {
      const response = await apiFetch<unknown>(`/admin/users/${id}`);
      setSelected(normalizeUserDetail(response));
      router.replace(`/admin/usuarios?id=${encodeURIComponent(id)}`, { scroll: false });
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível carregar os dados deste usuário.'));
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(searchParams.get('q') ?? '');
    const selectedId = searchParams.get('id');
    if (selectedId) {
      void openUser(selectedId);
    }
    // The initial URL is the source for the first load. Search changes use the
    // explicit form below so typing does not trigger a request per keystroke.
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = search.trim();
    router.replace(query ? `/admin/usuarios?q=${encodeURIComponent(query)}` : '/admin/usuarios', { scroll: false });
    void loadUsers(query);
  }

  return (
    <AdminPage
      description="Consulte carteiras, histórico e status das contas."
      title="Usuários"
    >
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="user-search">Buscar usuário</label>
        <input
          className="min-w-0 flex-1 rounded-xl border border-[#1c2436] bg-[#0d121c] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20"
          id="user-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por email ou nome"
          value={search}
        />
        <button className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-3 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500" type="submit">
          Buscar
        </button>
      </form>

      {error ? <div className="mt-5"><AdminError message={error} /></div> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#1c2436] bg-[#0d121c] shadow-card">
          <div className="border-b border-[#1c2436] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400" />
              <h3 className="font-bold text-white">Contas cadastradas</h3>
            </div>
          </div>
          {isLoading ? <div className="p-5"><AdminLoading /></div> : null}
          {!isLoading && users.length === 0 ? <p className="p-5 text-xs text-slate-500">Nenhum usuário encontrado.</p> : null}
          {!isLoading && users.length > 0 ? (
            <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#1c2436] bg-[#111622] text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold" scope="col">Usuário</th>
                    <th className="px-5 py-3 font-semibold" scope="col">Saldo</th>
                    <th className="px-5 py-3 font-semibold" scope="col">Status</th>
                    <th className="px-5 py-3" scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2436]">
                  {users.map((user) => (
                    <tr className={`transition ${selected?.id === user.id ? 'bg-cyan-950/30' : 'hover:bg-[#121824]'}`} key={user.id}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-white">{getText(user.name, user.email)}</p>
                        <p className="mt-1 text-xs text-slate-400">{user.email}</p>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-200">{getNumber(user.balance)}</td>
                      <td className="px-5 py-4"><AdminStatus status={user.status} /></td>
                      <td className="px-5 py-4 text-right">
                        <button className="text-xs font-bold text-cyan-400 transition hover:text-cyan-300" onClick={() => void openUser(user.id)} type="button">
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor ? <div className="border-t border-[#1c2436] px-5 py-4 text-center"><button className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 transition hover:text-cyan-300 disabled:cursor-wait disabled:opacity-60" disabled={isLoadingMore} onClick={() => void loadUsers(search, nextCursor, true)} type="button">{isLoadingMore ? (<><OrbLoader color="#22d3ee" size={20} state="working" /><span>Carregando...</span></>) : 'Carregar mais'}</button></div> : null}
            </>
          ) : null}
        </section>

        <UserPanel
          isLoading={isDetailLoading}
          onChanged={(user) => {
            setSelected(user);
            setUsers((current) => current.map((item) => item.id === user.id ? { ...item, ...user, balance: getBalance(user) } : item));
          }}
          user={selected}
        />
      </div>
    </AdminPage>
  );
}

function UserPanel({
  user,
  isLoading,
  onChanged,
}: Readonly<{
  user?: AdminUserDetail;
  isLoading: boolean;
  onChanged: (user: AdminUserDetail) => void;
}>) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  if (isLoading) {
    return <aside className="rounded-2xl border border-[#1c2436] bg-[#0d121c] p-5 shadow-card"><AdminLoading /></aside>;
  }

  if (!user) {
    return <aside className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-[#1c2436] bg-[#0d121c] p-6 text-center text-xs text-slate-500">Selecione um usuário para ver os detalhes.</aside>;
  }

  const currentUser = user;
  const transactions = user.transactions ?? [];

  async function adjustWallet(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(undefined);
    setActionError(undefined);
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount === 0 || !reason.trim()) {
      setActionError('Informe uma quantidade inteira diferente de zero e um motivo.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch<unknown>(`/admin/users/${currentUser.id}/wallet`, {
        method: 'PATCH',
        body: JSON.stringify({ amount: parsedAmount, reason: reason.trim() }),
      });
      const refreshed = await apiFetch<unknown>(`/admin/users/${currentUser.id}`);
      const updated = normalizeUserDetail(refreshed, currentUser);
      onChanged(updated);
      setAmount('');
      setReason('');
      setMessage('Ajuste registrado no extrato.');
    } catch (error) {
      setActionError(adminErrorMessage(error, 'Não foi possível ajustar o saldo.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStatus(): Promise<void> {
    setMessage(undefined);
    setActionError(undefined);
    const nextStatus = currentUser.status === 'suspended' ? 'active' : 'suspended';
    const actionLabel = nextStatus === 'active' ? 'reativar' : 'suspender';

    if (!window.confirm(`Deseja ${actionLabel} o usuário ${currentUser.email}?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch<unknown>(`/admin/users/${currentUser.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      onChanged({ ...currentUser, ...normalizeUserDetail(response, currentUser), status: nextStatus });
      setMessage(nextStatus === 'active' ? 'Usuário reativado.' : 'Usuário suspenso.');
    } catch (error) {
      setActionError(adminErrorMessage(error, 'Não foi possível atualizar o status.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="rounded-2xl border border-[#1c2436] bg-[#0d121c] p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detalhes da conta</p>
          <h3 className="mt-1 text-xl font-bold text-white">{getText(user.name, user.email)}</h3>
          <p className="mt-1 break-all text-xs text-slate-400">{user.email}</p>
        </div>
        <AdminStatus status={user.status} />
      </div>

      <div className="mt-5 rounded-xl border border-[#1c2436] bg-[#121824] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saldo atual</p>
        <p className="mt-1 text-3xl font-black text-white">{getBalance(user)}</p>
        <p className="mt-1 text-[11px] text-slate-500">ID: {user.id}</p>
      </div>

      <form className="mt-6 space-y-3 border-t border-[#1c2436] pt-5" onSubmit={(event) => void adjustWallet(event)}>
        <h4 className="font-bold text-white text-sm">Ajustar saldo</h4>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="wallet-amount">
          Créditos (+/-)
          <input
            className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20"
            id="wallet-amount"
            inputMode="numeric"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Ex.: 10 ou -2"
            value={amount}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400" htmlFor="wallet-reason">
          Motivo
          <textarea
            className="mt-1.5 min-h-20 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20"
            id="wallet-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Descreva por que o saldo foi ajustado"
            value={reason}
          />
        </label>
        <button className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500 disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? (<><OrbLoader color="#ffffff" size={20} state="working" /><span>Salvando...</span></>) : 'Ajustar saldo'}
        </button>
      </form>

      <button className="mt-3 inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-[#1a2233] hover:text-white disabled:opacity-60" disabled={isSaving} onClick={() => void toggleStatus()} type="button">
        {isSaving ? (<><OrbLoader color="#94a3b8" size={20} state="working" /><span>Processando...</span></>) : (user.status === 'suspended' ? 'Reativar usuário' : 'Suspender usuário')}
      </button>

      {message ? <p className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300" role="status">{message}</p> : null}
      {actionError ? <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300" role="alert">{actionError}</p> : null}

      <div className="mt-6 border-t border-[#1c2436] pt-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-bold text-white text-sm">Extrato</h4>
          <span className="text-xs text-slate-400">{transactions.length} lançamento{transactions.length === 1 ? '' : 's'}</span>
        </div>
        {transactions.length === 0 ? <p className="mt-3 text-xs text-slate-500">Nenhum lançamento encontrado.</p> : (
          <ul className="mt-3 divide-y divide-[#1c2436]">
            {transactions.map((transaction) => (
              <li className="py-3" key={transaction.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-200">{transaction.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(transaction.createdAt)}</p>
                  </div>
                  <span className={`text-xs font-bold ${transaction.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function normalizeUserDetail(value: unknown, fallback?: AdminUserDetail): AdminUserDetail {
  const root = isRecord(value) && isRecord(value.data) ? value.data : value;
  const source = isRecord(root) && isRecord(root.user) ? root.user : root;
  const base = isRecord(source) ? source : {};
  const wallet = isRecord(base.wallet) ? { balance: getNumber(base.wallet.balance) } : undefined;
  const transactionsSource = isRecord(root) ? root.transactions ?? base.transactions : undefined;
  const transactions = readItems<AdminUserDetail['transactions'] extends Array<infer T> ? T : never>(transactionsSource, ['items', 'data']);

  return {
    ...(fallback ?? {}),
    id: getText(base.id, fallback?.id ?? ''),
    email: getText(base.email, fallback?.email ?? ''),
    ...(typeof base.name === 'string' ? { name: base.name } : {}),
    ...(base.role === 'admin' || base.role === 'user' ? { role: base.role } : {}),
    ...(base.status === 'active' || base.status === 'suspended' ? { status: base.status } : {}),
    ...(typeof base.createdAt === 'string' ? { createdAt: base.createdAt } : {}),
    ...(wallet ? { wallet } : {}),
    ...(typeof base.balance === 'number' ? { balance: base.balance } : {}),
    transactions: transactions.length > 0 ? transactions : fallback?.transactions ?? [],
  };
}
