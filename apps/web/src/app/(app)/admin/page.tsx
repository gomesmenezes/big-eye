'use client';

import { useEffect, useState } from 'react';

import { AdminError, AdminLoading, AdminPage, adminErrorMessage } from '../../../components/admin/admin-shell';
import {
  formatFailureRate,
  getNumber,
  isRecord,
  readItems,
  type AdminDashboard,
} from '../../../components/admin/admin-types';
import { apiFetch } from '../../../lib/api';

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const response = await apiFetch<unknown>('/admin/dashboard');
        if (active) {
          setDashboard(normalizeDashboard(response));
        }
      } catch (error) {
        if (active) {
          setError(adminErrorMessage(error, 'Não foi possível carregar os indicadores agora.'));
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

  return (
    <AdminPage
      description="Acompanhe a operação, o consumo de créditos e a saúde das consultas."
      title="Resumo operacional"
    >
      {isLoading ? <AdminLoading /> : null}
      {error ? <AdminError message={error} /> : null}
      {!isLoading && !error && dashboard ? <DashboardContent dashboard={dashboard} /> : null}
    </AdminPage>
  );
}

function DashboardContent({ dashboard }: Readonly<{ dashboard: AdminDashboard }>) {
  const totals = dashboard.totals ?? dashboard;
  const moduleRows = dashboard.queriesByModule ?? [];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Novos usuários" value={getNumber(totals.newUsers)} />
        <Metric label="Créditos vendidos" value={getNumber(totals.creditsSold)} />
        <Metric label="Créditos consumidos" value={getNumber(totals.creditsConsumed)} />
        <Metric label="Taxa de falha" value={formatFailureRate(totals.failureRate)} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-950">Chamadas/Consultas</h3>
          <p className="mt-1 text-sm text-slate-500">Volume registrado no período consolidado pela API.</p>
        </div>
        {moduleRows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Ainda não há consultas para exibir.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold" scope="col">Chamadas/Consultas</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Consultas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {moduleRows.map((row) => (
                  <tr key={row.moduleSlug}>
                    <td className="px-5 py-3 font-medium text-slate-900">{row.moduleSlug}</td>
                    <td className="px-5 py-3 text-slate-600">{getNumber(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function normalizeDashboard(value: unknown): AdminDashboard {
  const source = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(source)) {
    return {};
  }

  const rawRows = source.queriesByModule ?? source.queriesByModuleSlug ?? source.byModule;
  const rows = readItems<unknown>(rawRows);
  const queriesByModule = rows.flatMap((row) => {
    if (!isRecord(row)) {
      return [];
    }

    const moduleSlug = row.moduleSlug ?? row.slug ?? row.module;
    const count = row.count ?? row.total;
    return typeof moduleSlug === 'string' ? [{ moduleSlug, count: getNumber(count) }] : [];
  });

  const totals = isRecord(source.totals) ? {
    newUsers: getNumber(source.totals.newUsers ?? source.totals.users),
    creditsSold: getNumber(source.totals.creditsSold ?? source.totals.sold),
    creditsConsumed: getNumber(source.totals.creditsConsumed ?? source.totals.consumed),
    failureRate: getNumber(source.totals.failureRate ?? source.totals.failure_rate),
  } : undefined;

  return {
    newUsers: getNumber(source.newUsers ?? source.new_users ?? source.users),
    creditsSold: getNumber(source.creditsSold ?? source.credits_sold),
    creditsConsumed: getNumber(source.creditsConsumed ?? source.credits_consumed),
    failureRate: getNumber(source.failureRate ?? source.failure_rate),
    queriesByModule,
    ...(totals ? { totals } : {}),
  };
}
