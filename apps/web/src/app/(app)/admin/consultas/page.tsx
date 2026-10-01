'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { AdminError, AdminLoading, AdminPage, AdminStatus, adminErrorMessage } from '../../../../components/admin/admin-shell';
import {
  formatDate,
  getText,
  isRecord,
  readItems,
  readNextCursor,
  type AdminQuery,
  type AdminQueryDetail,
  type AdminQueryEvent,
} from '../../../../components/admin/admin-types';
import { OrbLoader } from '../../../../components/orb-loader';
import { apiFetch } from '../../../../lib/api';

const statuses = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'running', label: 'Processando' },
  { value: 'succeeded', label: 'Concluída' },
  { value: 'failed', label: 'Falhou' },
  { value: 'refunded', label: 'Reembolsada' },
];

export default function AdminQueriesPage() {
  const [queries, setQueries] = useState<AdminQuery[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [selected, setSelected] = useState<AdminQueryDetail>();
  const [status, setStatus] = useState('');
  const [moduleSlug, setModuleSlug] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function loadQueries(cursor?: string, append = false): Promise<void> {
    setIsLoading(!append);
    setIsLoadingMore(append);
    setError(undefined);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (moduleSlug.trim()) params.set('module', moduleSlug.trim());
    if (userId.trim()) params.set('userId', userId.trim());
    if (cursor) params.set('cursor', cursor);

    try {
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch<unknown>(`/admin/queries${suffix}`);
      const items = readItems<AdminQuery>(response, ['items', 'queries', 'data']);
      setQueries((current) => append ? [...current, ...items] : items);
      setNextCursor(readNextCursor(response));
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível carregar as consultas.'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  async function openQuery(id: string): Promise<void> {
    setIsDetailLoading(true);
    setError(undefined);

    try {
      const response = await apiFetch<unknown>(`/admin/queries/${id}`);
      setSelected(normalizeQueryDetail(response));
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível carregar os detalhes desta consulta.'));
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadQueries();
  }, []);

  function submitFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void loadQueries();
  }

  async function runAction(action: 'retry' | 'refund', query: AdminQueryDetail): Promise<void> {
    setIsActionRunning(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const response = await apiFetch<unknown>(`/admin/queries/${query.id}/${action}`, { method: 'POST' });
      const updated = normalizeQueryDetail(response, query);
      setSelected(updated);
      setQueries((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setMessage(action === 'retry' ? 'Consulta reenfileirada sem novo débito.' : 'Consulta reembolsada.');
    } catch (error) {
      setError(adminErrorMessage(error, action === 'retry' ? 'Não foi possível reenfileirar a consulta.' : 'Não foi possível reembolsar a consulta.'));
    } finally {
      setIsActionRunning(false);
    }
  }

  return (
    <AdminPage
      description="Inspecione o histórico, acompanhe transições e intervenha em consultas que precisam de retry ou reembolso."
      title="Consultas"
    >
      <form className="grid gap-3 rounded-2xl border border-[#1c2436] bg-[#0d121c] p-4 shadow-card md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={submitFilters}>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Status
          <select className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" onChange={(event) => setStatus(event.target.value)} value={status}>
            {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Chamadas/Consultas
          <input className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" onChange={(event) => setModuleSlug(event.target.value)} placeholder="cpf-basico" value={moduleSlug} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          ID do usuário
          <input className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" onChange={(event) => setUserId(event.target.value)} placeholder="UUID" value={userId} />
        </label>
        <button className="self-end rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500" type="submit">Filtrar</button>
      </form>

      {error ? <div className="mt-5"><AdminError message={error} /></div> : null}
      {message ? <p className="mt-5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-300" role="status">{message}</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#1c2436] bg-[#0d121c] shadow-card">
          <div className="border-b border-[#1c2436] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400" />
              <h3 className="font-bold text-white">Histórico de consultas</h3>
            </div>
          </div>
          {isLoading ? <div className="p-5"><AdminLoading /></div> : null}
          {!isLoading && queries.length === 0 ? <p className="p-5 text-xs text-slate-500">Nenhuma consulta encontrada.</p> : null}
          {!isLoading && queries.length > 0 ? (
            <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#1c2436] bg-[#111622] text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold" scope="col">Consulta</th>
                    <th className="px-5 py-3 font-semibold" scope="col">Usuário</th>
                    <th className="px-5 py-3 font-semibold" scope="col">Status</th>
                    <th className="px-5 py-3 font-semibold" scope="col">Criada em</th>
                    <th className="px-5 py-3" scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2436]">
                  {queries.map((query) => (
                    <tr className={`transition ${selected?.id === query.id ? 'bg-cyan-950/30' : 'hover:bg-[#121824]'}`} key={query.id}>
                      <td className="px-5 py-4"><p className="font-medium text-white">{query.moduleSlug}</p><p className="mt-1 text-[11px] text-slate-400">{query.id}</p></td>
                      <td className="px-5 py-4 text-xs text-slate-300">{getText(query.userEmail, query.userId)}</td>
                      <td className="px-5 py-4"><AdminStatus status={query.status} /></td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">{formatDate(query.createdAt)}</td>
                      <td className="px-5 py-4 text-right"><button className="text-xs font-bold text-cyan-400 transition hover:text-cyan-300" onClick={() => void openQuery(query.id)} type="button">Abrir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor ? <div className="border-t border-[#1c2436] px-5 py-4 text-center"><button className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 transition hover:text-cyan-300 disabled:cursor-wait disabled:opacity-60" disabled={isLoadingMore} onClick={() => void loadQueries(nextCursor, true)} type="button">{isLoadingMore ? (<><OrbLoader color="#22d3ee" size={20} state="working" /><span>Carregando...</span></>) : 'Carregar mais'}</button></div> : null}
            </>
          ) : null}
        </section>

        <QueryPanel
          isActionRunning={isActionRunning}
          isLoading={isDetailLoading}
          onAction={(action) => selected ? void runAction(action, selected) : undefined}
          query={selected}
        />
      </div>
    </AdminPage>
  );
}

function QueryPanel({
  query,
  isLoading,
  isActionRunning,
  onAction,
}: Readonly<{
  query?: AdminQueryDetail;
  isLoading: boolean;
  isActionRunning: boolean;
  onAction: (action: 'retry' | 'refund') => void;
}>) {
  if (isLoading) return <aside className="rounded-2xl border border-[#1c2436] bg-[#0d121c] p-5 shadow-card"><AdminLoading /></aside>;
  if (!query) return <aside className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-[#1c2436] bg-[#0d121c] p-6 text-center text-xs text-slate-500">Selecione uma consulta para ver os detalhes.</aside>;

  const currentQuery = query;
  const canRetry = currentQuery.status === 'failed' || currentQuery.status === 'refunded';
  const canRefund = currentQuery.status === 'failed' || currentQuery.status === 'succeeded' || currentQuery.status === 'running' || currentQuery.status === 'pending';

  function requestAction(action: 'retry' | 'refund'): void {
    if (action === 'refund' && !window.confirm(`Reembolsar a consulta ${currentQuery.id}?`)) {
      return;
    }

    onAction(action);
  }

  return (
    <aside className="rounded-2xl border border-[#1c2436] bg-[#0d121c] p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detalhes</p><h3 className="mt-1 text-xl font-bold text-white">{query.moduleSlug}</h3></div>
        <AdminStatus status={query.status} />
      </div>
      <dl className="mt-5 divide-y divide-[#1c2436] rounded-xl border border-[#1c2436] bg-[#121824] text-xs">
        <DetailRow label="ID" value={query.id} mono />
        <DetailRow label="Usuário" value={getText(query.userEmail, query.userId)} />
        <DetailRow label="Entrada mascarada" value={getText(query.inputMasked)} />
        <DetailRow label="Criada em" value={formatDate(query.createdAt)} />
        <DetailRow label="Idempotency key" value={getText(query.idempotencyKey)} />
      </dl>

      {query.errorMessage ? <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300" role="alert">{query.errorMessage}</p> : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {canRetry ? <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500 disabled:opacity-60" disabled={isActionRunning} onClick={() => requestAction('retry')} type="button">{isActionRunning ? (<><OrbLoader color="#ffffff" size={20} state="working" /><span>Processando...</span></>) : 'Tentar novamente'}</button> : null}
        {canRefund ? <button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-2.5 text-xs font-bold text-red-300 transition hover:bg-red-900/50 disabled:opacity-60" disabled={isActionRunning} onClick={() => requestAction('refund')} type="button">{isActionRunning ? (<><OrbLoader color="#fca5a5" size={20} state="working" /><span>Processando...</span></>) : 'Reembolsar'}</button> : null}
      </div>

      <div className="mt-6 border-t border-[#1c2436] pt-5">
        <h4 className="font-bold text-white text-sm">Eventos</h4>
        {(query.events ?? []).length === 0 ? <p className="mt-3 text-xs text-slate-500">Nenhum evento registrado.</p> : (
          <ol className="mt-3 space-y-2.5">
            {(query.events ?? []).map((event) => <li className="rounded-xl border border-[#1c2436] bg-[#121824] p-3 text-xs" key={event.id}><div className="flex items-center justify-between gap-3 text-[11px] text-slate-400"><span>{event.source}</span><time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></div><p className="mt-1 font-medium text-slate-200">{event.message}</p><p className="mt-1 text-[11px] text-cyan-400">{event.fromStatus ?? '—'} → {event.toStatus}</p></li>)}
          </ol>
        )}
      </div>
    </aside>
  );
}

function DetailRow({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[9rem_1fr]"><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt><dd className={`break-all text-slate-200 ${mono ? 'text-xs text-cyan-300' : ''}`}>{value}</dd></div>;
}

function normalizeQueryDetail(value: unknown, fallback?: AdminQueryDetail): AdminQueryDetail {
  const root = isRecord(value) && isRecord(value.data) ? value.data : value;
  const source = isRecord(root) && isRecord(root.query) ? root.query : root;
  const base = isRecord(source) ? source : {};
  const profile = isRecord(base.user) ? base.user : undefined;
  const rawEvents = isRecord(root) ? root.events ?? base.events : undefined;
  const events = readItems<AdminQueryEvent>(rawEvents, ['items', 'data']);

  return {
    ...(fallback ?? {}),
    id: getText(base.id, fallback?.id ?? ''),
    moduleSlug: getText(base.moduleSlug ?? base.module, fallback?.moduleSlug ?? ''),
    status: isQueryStatus(base.status) ? base.status : fallback?.status ?? 'pending',
    createdAt: getText(base.createdAt, fallback?.createdAt ?? ''),
    ...(typeof base.userId === 'string' ? { userId: base.userId } : {}),
    ...(typeof base.userEmail === 'string' ? { userEmail: base.userEmail } : {}),
    ...(typeof base.userName === 'string' ? { userName: base.userName } : {}),
    ...(typeof profile?.email === 'string' ? { userEmail: profile.email } : {}),
    ...(typeof profile?.name === 'string' ? { userName: profile.name } : {}),
    ...(base.mode === 'sync' || base.mode === 'async' ? { mode: base.mode } : {}),
    ...(typeof base.creditsCharged === 'number' ? { creditsCharged: base.creditsCharged } : {}),
    ...(typeof base.inputMasked === 'string' ? { inputMasked: base.inputMasked } : {}),
    ...(typeof base.idempotencyKey === 'string' ? { idempotencyKey: base.idempotencyKey } : {}),
    ...(typeof base.errorCode === 'string' || base.errorCode === null ? { errorCode: base.errorCode } : {}),
    ...(typeof base.errorMessage === 'string' || base.errorMessage === null ? { errorMessage: base.errorMessage } : {}),
    ...(typeof base.startedAt === 'string' || base.startedAt === null ? { startedAt: base.startedAt } : {}),
    ...(typeof base.finishedAt === 'string' || base.finishedAt === null ? { finishedAt: base.finishedAt } : {}),
    events: events.length > 0 ? events : fallback?.events ?? [],
  };
}

function isQueryStatus(value: unknown): value is AdminQuery['status'] {
  return value === 'pending' || value === 'running' || value === 'succeeded' || value === 'failed' || value === 'refunded';
}
