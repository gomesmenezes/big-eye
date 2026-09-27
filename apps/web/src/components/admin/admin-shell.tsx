'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { statusClass, statusLabel } from './admin-types';

const navigation = [
  { href: '/admin', label: 'Resumo' },
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/consultas', label: 'Consultas' },
  { href: '/admin/pagamentos', label: 'Pagamentos' },
  { href: '/admin/pacotes', label: 'Pacotes' },
];

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="border-t border-slate-200 bg-slate-100/70">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link className="text-sm font-semibold text-teal-800 hover:text-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" href="/dashboard">
              ← Voltar ao app
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operações</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Backoffice Big Eye</h1>
          </div>
          <nav aria-label="Navegação administrativa" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {navigation.map((item) => {
              const isActive = item.href === '/admin'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-teal-800 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}

export function AdminPage({
  title,
  description,
  actions,
  children,
}: Readonly<{
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function AdminError({ message }: Readonly<{ message: string }>) {
  return (
    <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800" role="alert">
      {message}
    </p>
  );
}

export function AdminLoading() {
  return (
    <div className="space-y-4" aria-label="Carregando">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

export function AdminStatus({ status }: Readonly<{ status: string | undefined }>) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{statusLabel(status)}</span>;
}
