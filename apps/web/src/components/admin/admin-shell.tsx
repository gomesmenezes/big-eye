'use client';

import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
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
    <div className="border-t border-zinc-800/80 bg-[#09090b] min-h-screen text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 transition hover:text-cyan-300"
              href="/dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>← Voltar ao app</span>
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Operações de Backoffice
              </p>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 p-1">
                <Image
                  alt="Big Eye"
                  className="h-5 w-auto object-contain"
                  height={24}
                  src="/logo-icon.png"
                  width={24}
                />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">Backoffice Big Eye</h1>
            </div>
          </div>
          <nav aria-label="Navegação administrativa" className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-1">
            {navigation.map((item) => {
              const isActive = item.href === '/admin'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-zinc-800 text-white border border-zinc-700/80'
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
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
          <h2 className="text-2xl font-extrabold tracking-tight text-white">{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">{description}</p>
        </div>
        {actions}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function AdminError({ message }: Readonly<{ message: string }>) {
  return (
    <p className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-xs text-red-300" role="alert">
      {message}
    </p>
  );
}

export function adminErrorMessage(error: unknown, fallback: string): string {
  const status = getErrorStatus(error);

  if (status === 401) {
    return 'Sua sessão expirou. Entre novamente para continuar.';
  }

  if (status === 403) {
    return 'Você não tem permissão para acessar esta área ou executar esta ação.';
  }

  return fallback;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

export function AdminLoading() {
  return (
    <div className="space-y-4" aria-label="Carregando">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-[#0d121c]" />
      <div className="h-48 animate-pulse rounded-2xl bg-[#0d121c]" />
    </div>
  );
}

export function AdminStatus({ status }: Readonly<{ status: string | undefined }>) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{statusLabel(status)}</span>;
}
