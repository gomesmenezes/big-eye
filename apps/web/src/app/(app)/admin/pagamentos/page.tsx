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
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[12rem_minmax(0,1fr)_auto]" onSubmit={submitFilters}>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" onChange={(event) => setStatus(event.target.value)} value={status}>
            {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          ID do usuário
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" onChange={(event) => setUserId(event.target.value)} placeholder="UUID" value={userId} />
        </label>
        <button className="self-end rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" type="submit">Filtrar</button>
      </form>

      {error ? <div className="mt-5"><AdminError message={error} /></div> : null}
      {message ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{message}</p> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-950">Transações de pagamento</h3></div>
        {isLoading ? <div className="p-5"><AdminLoading /></div> : null}
        {!isLoading && payments.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhum pagamento encontrado.</p> : null}
        {!isLoading && payments.length > 0 ? (
          <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold" scope="col">Pagamento</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Usuário</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Valor</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Créditos</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Status</th>
                  <th className="px-5 py-3" scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4"><p className="font-medium text-slate-900">{payment.method === 'pix' ? 'Pix' : 'Cartão'}</p><p className="mt-1 font-mono text-xs text-slate-500">{payment.id}</p><p className="mt-1 text-xs text-slate-500">{formatDate(payment.createdAt)}</p></td>
                    <td className="px-5 py-4 text-slate-600">{getText(payment.userEmail, payment.userId)}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{formatCurrency(payment.amountCents)}</td>
                    <td className="px-5 py-4 text-slate-600">{payment.credits}</td>
                    <td className="px-5 py-4"><AdminStatus status={payment.status} /></td>
                    <td className="px-5 py-4 text-right">{payment.status === 'pending' || payment.status === 'failed' ? <button className="text-sm font-semibold text-teal-800 hover:text-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50" disabled={runningId === payment.id} onClick={() => void reprocess(payment)} type="button">{runningId === payment.id ? 'Enviando...' : 'Reprocessar'}</button> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor ? <div className="border-t border-slate-100 px-5 py-4 text-center"><button className="text-sm font-semibold text-teal-800 hover:text-teal-900 disabled:cursor-wait disabled:opacity-60" disabled={isLoadingMore} onClick={() => void loadPayments(nextCursor, true)} type="button">{isLoadingMore ? 'Carregando...' : 'Carregar mais'}</button></div> : null}
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
