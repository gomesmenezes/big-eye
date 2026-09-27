'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { createSupabaseBrowserClient } from '../lib/supabase/client';

const navigation = [
  { href: '/dashboard', label: 'Visão geral' },
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/creditos', label: 'Créditos' },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut(): Promise<void> {
    setIsSigningOut(true);
    await createSupabaseBrowserClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-mineral">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" href="/dashboard">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-petrol-600 text-sm font-bold text-white">
              BE
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-950">Big Eye</span>
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-petrol-50 text-petrol-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-60"
            disabled={isSigningOut}
            onClick={() => void signOut()}
            type="button"
          >
            {isSigningOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
        <nav aria-label="Navegação móvel" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 md:hidden sm:px-6">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-petrol-50 text-petrol-700' : 'text-slate-600'
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
