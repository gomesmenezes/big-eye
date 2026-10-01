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

      <section className="mt-8 rounded-2xl border border-[#1c2436] bg-[#0d121c] shadow-card overflow-hidden">
        <div className="border-b border-[#1c2436] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400" />
            <h3 className="font-bold text-white">Chamadas/Consultas</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">Volume registrado no período consolidado pela API.</p>
        </div>
        {moduleRows.length === 0 ? (
          <p className="px-5 py-8 text-xs text-slate-500">Ainda não há consultas para exibir.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#1c2436] bg-[#111622] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold" scope="col">Chamadas/Consultas</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Consultas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2436]">
                {moduleRows.map((row) => (
                  <tr className="hover:bg-[#121824] transition" key={row.moduleSlug}>
                    <td className="px-5 py-3 font-medium text-cyan-300">{row.moduleSlug}</td>
                    <td className="px-5 py-3 text-slate-300">{getNumber(row.count)}</td>
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
    <article className="rounded-2xl border border-[#1c2436] bg-[#0d121c] p-5 shadow-card transition hover:border-[#2a3752]">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-white">{value}</p>
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
