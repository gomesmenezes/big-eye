'use client';

import {
  Compass,
  Cpu,
  Coins,
  LogOut,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import type { MeDTOType } from '@big-eye/contracts';

import { apiFetchPath } from '../lib/api';
import { createSupabaseBrowserClient } from '../lib/supabase/client';

import { AthenasStatusSidebar } from './athenas-api-status';

const navigation = [
  { href: '/dashboard', label: 'Visão Geral', icon: Compass, badge: 'Live' },
  { href: '/catalogo', label: 'Buscas', icon: Cpu, badge: null },
  { href: '/creditos', label: 'Carteira & Créditos', icon: Coins, badge: null },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeDTOType | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchMe() {
      try {
        const profile = await apiFetchPath('/me');
        if (active) setMe(profile);
      } catch {
        // Not authenticated
      }
    }
    void fetchMe();
    return () => {
      active = false;
    };
  }, [pathname]);

  async function signOut(): Promise<void> {
    setIsSigningOut(true);
    await createSupabaseBrowserClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const userInitial = (me?.name?.[0] || me?.email?.[0] || 'O').toUpperCase();
  const userName = me?.name || me?.email?.split('@')[0] || 'Operador';
  const userEmail = me?.email || 'operador@bigeye.intel';

  return (
    <div className="flex min-h-screen flex-col bg-[#080a0f] text-[#f3f6fc] antialiased selection:bg-cyan-900/50 selection:text-cyan-200 md:h-screen md:flex-row md:overflow-hidden">
      {/* Mobile Bar */}
      <header className="flex h-16 items-center justify-between border-b border-[#1c2436] bg-[#0d111a] px-4 md:hidden">
        <Link className="flex items-center gap-2.5" href="/dashboard">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <Image
              alt="Big Eye"
              className="h-7 w-auto object-contain drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]"
              height={32}
              src="/logo-icon.png"
              width={32}
            />
          </div>
          <div>
            <span className="text-sm font-black tracking-widest text-white uppercase">
              BIG EYE
            </span>
          </div>
        </Link>

        <button
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          className="rounded-lg p-2 text-slate-400 hover:bg-[#161d2d] hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          type="button"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Modern Cybernetic Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-[#1a2233] bg-[#0b0e16]/95 backdrop-blur-md transition-transform duration-200 md:static md:h-full md:w-72 md:shrink-0 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-1 flex-col overflow-y-auto p-5 min-h-0 [scrollbar-width:thin] [scrollbar-color:#1c2436_transparent]">
          {/* Logo & Network Status */}
          <div className="mb-6 flex items-start justify-between border-b border-[#172030] pb-5">
            <Link
              className="group flex items-center gap-3"
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-gradient-to-tr from-cyan-950/60 to-slate-900/80 p-1 shadow-glow transition group-hover:scale-105 group-hover:border-cyan-400">
                <Image
                  alt="Big Eye"
                  className="h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  height={44}
                  priority
                  src="/logo-icon.png"
                  width={44}
                />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-wider text-white">
                  BIG EYE
                </span>
              </div>
            </Link>
          </div>

          <AthenasStatusSidebar onNavigate={() => setMobileMenuOpen(false)} />

          {/* Nav Section */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Plataforma
            </p>
            <nav aria-label="Navegação principal" className="mt-2 space-y-1">
              {navigation.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 to-blue-950/30 text-white shadow-glow'
                        : 'border border-transparent text-slate-400 hover:border-[#1c2436] hover:bg-[#121824] hover:text-slate-200'
                    }`}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 transition ${
                          isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span className="rounded-full bg-cyan-950 px-2 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-800/50">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Interactive Balance HUD in Sidebar */}
          <div className="mt-8 rounded-2xl border border-cyan-900/30 bg-gradient-to-b from-[#111724] to-[#0c101a] p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Saldo de Operações
              </span>
              <Coins className="h-4 w-4 text-cyan-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-white">
                {me?.balance ?? 0}
              </span>
              <span className="text-xs font-medium text-slate-400">créditos</span>
            </div>

            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Pronto para consultas imediatas ou investigações profundas.
            </p>

            <Link
              className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 py-2 px-3 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500"
              href="/creditos"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Recarregar Carteira</span>
            </Link>
          </div>
        </div>

        {/* User Footer Profile */}
        <div className="shrink-0 border-t border-[#1a2233] bg-[#0b0e16] p-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1a2233] bg-[#10141f] p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-900 to-blue-900 text-xs font-bold text-cyan-300 border border-cyan-700/40">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-200">{userName}</p>
                <p className="truncate text-[10px] text-slate-500">{userEmail}</p>
              </div>
            </div>

            <button
              aria-label="Sair da conta"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-950/40 hover:text-red-400 disabled:opacity-50"
              disabled={isSigningOut}
              onClick={() => void signOut()}
              title="Sair"
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-10 min-w-0">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
