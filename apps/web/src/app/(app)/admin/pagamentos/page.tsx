'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { AdminError, AdminLoading, AdminPage, AdminStatus, adminErrorMessage } from '../../../../components/admin/admin-shell';
import {
  formatCurrency,
  formatDate,
  getText,
  isRecord,
  readItems,
  readNextCursor,
  type AdminPayment,
} from '../../../../components/admin/admin-types';
import { OrbLoader } from '../../../../components/orb-loader';
import { apiFetch } from '../../../../lib/api';

const statuses = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'paid', label: 'Pago' },
  { value: 'failed', label: 'Falhou' },
  { value: 'expired', label: 'Expirado' },
  { value: 'refunded', label: 'Reembolsado' },
];

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [runningId, setRunningId] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function loadPayments(cursor?: string, append = false): Promise<void> {
    setIsLoading(!append);
    setIsLoadingMore(append);
    setError(undefined);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (userId.trim()) params.set('userId', userId.trim());
    if (cursor) params.set('cursor', cursor);

    try {
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch<unknown>(`/admin/payments${suffix}`);
      const items = readItems<AdminPayment>(response, ['items', 'payments', 'data']).map((item) => normalizePayment(item));
      setPayments((current) => append ? [...current, ...items] : items);
      setNextCursor(readNextCursor(response));
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível carregar os pagamentos.'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, []);

  function submitFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void loadPayments();
  }

  async function reprocess(payment: AdminPayment): Promise<void> {
    setRunningId(payment.id);
    setError(undefined);
    setMessage(undefined);

    try {
      const response = await apiFetch<unknown>(`/admin/payments/${payment.id}/reprocess`, { method: 'POST' });
      const updated = normalizePayment(response, payment);
      setPayments((current) => current.map((item) => item.id === payment.id ? updated : item));
      setMessage('Pagamento enviado para reprocessamento.');
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível reprocessar este pagamento.'));
    } finally {
      setRunningId(undefined);
    }
  }

  return (
    <AdminPage
      description="Veja cobranças, situação no provedor e reprocese pagamentos que ficaram pendentes."
      title="Pagamentos"
    >
      <form className="grid gap-3 rounded-2xl border border-[#1c2436] bg-[#0d121c] p-4 shadow-card sm:grid-cols-[12rem_minmax(0,1fr)_auto]" onSubmit={submitFilters}>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Status
          <select className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" onChange={(event) => setStatus(event.target.value)} value={status}>
            {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          ID do usuário
          <input className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" onChange={(event) => setUserId(event.target.value)} placeholder="UUID" value={userId} />
        </label>
        <button className="self-end rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500" type="submit">Filtrar</button>
      </form>

      {error ? <div className="mt-5"><AdminError message={error} /></div> : null}
      {message ? <p className="mt-5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-300" role="status">{message}</p> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#1c2436] bg-[#0d121c] shadow-card">
        <div className="border-b border-[#1c2436] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400" />
            <h3 className="font-bold text-white">Transações de pagamento</h3>
          </div>
        </div>
        {isLoading ? <div className="p-5"><AdminLoading /></div> : null}
        {!isLoading && payments.length === 0 ? <p className="p-5 text-xs text-slate-500">Nenhum pagamento encontrado.</p> : null}
        {!isLoading && payments.length > 0 ? (
          <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#1c2436] bg-[#111622] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold" scope="col">Pagamento</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Usuário</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Valor</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Créditos</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Status</th>
                  <th className="px-5 py-3" scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2436]">
                {payments.map((payment) => (
                  <tr className="hover:bg-[#121824] transition" key={payment.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-white">{payment.method === 'pix' ? 'Pix' : 'Cartão'}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{payment.id}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(payment.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">{getText(payment.userEmail, payment.userId)}</td>
                    <td className="px-5 py-4 font-bold text-cyan-300">{formatCurrency(payment.amountCents)}</td>
                    <td className="px-5 py-4 text-slate-200">{payment.credits}</td>
                    <td className="px-5 py-4"><AdminStatus status={payment.status} /></td>
                    <td className="px-5 py-4 text-right">{payment.status === 'pending' || payment.status === 'failed' ? <button className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 transition hover:text-cyan-300 disabled:opacity-50" disabled={runningId === payment.id} onClick={() => void reprocess(payment)} type="button">{runningId === payment.id ? (<><OrbLoader color="#22d3ee" size={20} state="working" /><span>Enviando...</span></>) : 'Reprocessar'}</button> : <span className="text-xs text-slate-500">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor ? <div className="border-t border-[#1c2436] px-5 py-4 text-center"><button className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 transition hover:text-cyan-300 disabled:cursor-wait disabled:opacity-60" disabled={isLoadingMore} onClick={() => void loadPayments(nextCursor, true)} type="button">{isLoadingMore ? (<><OrbLoader color="#22d3ee" size={20} state="working" /><span>Carregando...</span></>) : 'Carregar mais'}</button></div> : null}
          </>
        ) : null}
      </section>
    </AdminPage>
  );
}

function normalizePayment(value: unknown, fallback?: AdminPayment): AdminPayment {
  const root = isRecord(value) && isRecord(value.data) ? value.data : value;
  const source = isRecord(root) && isRecord(root.payment) ? root.payment : root;
  const base = isRecord(source) ? source : {};
  const method = base.method === 'card' ? 'card' : 'pix';
  const status = isPaymentStatus(base.status) ? base.status : fallback?.status ?? 'pending';

  return {
    ...(fallback ?? {}),
    id: getText(base.id, fallback?.id ?? ''),
    method,
    status,
    amountCents: typeof base.amountCents === 'number' ? base.amountCents : fallback?.amountCents ?? 0,
    credits: typeof base.credits === 'number' ? base.credits : fallback?.credits ?? 0,
    createdAt: getText(base.createdAt, fallback?.createdAt ?? ''),
    ...(typeof base.userId === 'string' ? { userId: base.userId } : {}),
    ...(typeof base.userEmail === 'string' ? { userEmail: base.userEmail } : {}),
    ...(typeof base.provider === 'string' ? { provider: base.provider } : {}),
    ...(typeof base.providerPaymentId === 'string' || base.providerPaymentId === null ? { providerPaymentId: base.providerPaymentId } : {}),
    ...(typeof base.paidAt === 'string' || base.paidAt === null ? { paidAt: base.paidAt } : {}),
    ...(typeof base.expiresAt === 'string' ? { expiresAt: base.expiresAt } : {}),
  };
}

function isPaymentStatus(value: unknown): value is AdminPayment['status'] {
  return value === 'pending' || value === 'paid' || value === 'failed' || value === 'expired' || value === 'refunded';
}
