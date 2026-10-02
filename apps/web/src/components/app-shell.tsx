'use client';

import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Coins,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import type { MeDTOType } from '@big-eye/contracts';

import { apiFetchPath } from '../lib/api';
import { createSupabaseBrowserClient } from '../lib/supabase/client';

import { AthenasStatusBadge } from './athenas-api-status';

interface ResourceItem {
  name: string;
  tag: string;
  color: string;
  href: string;
}

const resources: ResourceItem[] = [
  {
    name: 'CPF Completo',
    tag: 'Ativo',
    color: 'bg-emerald-400',
    href: '/consulta/cpf-basico',
  },
  {
    name: 'Dossiê 360',
    tag: 'Especial',
    color: 'bg-purple-400',
    href: '/consulta/dossie-360',
  },
  {
    name: 'CNPJ Completo',
    tag: 'Receita',
    color: 'bg-blue-400',
    href: '/consulta/cnpj-basico',
  },
  {
    name: 'CPF DETRAN',
    tag: 'SERPRO',
    color: 'bg-cyan-400',
    href: '/consulta/cpf-detran',
  },
  {
    name: 'Veículo por Placa',
    tag: 'BIN',
    color: 'bg-amber-400',
    href: '/consulta/placa-basico',
  },
  {
    name: 'Status da Rede',
    tag: 'Gateway',
    color: 'bg-rose-400',
    href: '/dashboard#api-status',
  },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeDTOType | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [queriesOpen, setQueriesOpen] = useState(true);
  const [resourcesOpen, setResourcesOpen] = useState(false); // Closed by default
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);

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

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setHeaderMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function signOut(): Promise<void> {
    setIsSigningOut(true);
    await createSupabaseBrowserClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const userInitial = (me?.name?.[0] || me?.email?.[0] || 'O').toUpperCase();
  const userName = me?.name || me?.email?.split('@')[0] || 'Operador';
  const userEmail = me?.email || 'operador@bigeye.intel';

  // Dynamic breadcrumbs based on pathname
  const breadcrumbs = useMemo(() => {
    if (pathname === '/dashboard') {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Visão Geral', href: '/dashboard', current: true },
      ];
    }
    if (pathname === '/catalogo') {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Catálogo de Consultas', href: '/catalogo', current: true },
      ];
    }
    if (pathname === '/creditos') {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Carteira & Créditos', href: '/creditos', current: true },
      ];
    }
    if (pathname.startsWith('/consulta/')) {
      const slug = pathname.replace('/consulta/', '');
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Consultas', href: '/catalogo' },
        { label: slug.toUpperCase(), href: pathname, current: true },
      ];
    }
    if (pathname.startsWith('/admin')) {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Backoffice Admin', href: '/admin', current: true },
      ];
    }
    return [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Plataforma', href: pathname, current: true },
    ];
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-zinc-800 selection:text-white md:h-screen md:flex-row md:overflow-hidden">
      {/* Mobile Bar */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-800/80 bg-[#0c0c0e] px-4 md:hidden">
        <Link className="flex items-center gap-2.5" href="/dashboard">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            <Image
              alt="Big Eye"
              className="h-4.5 w-auto object-contain"
              height={20}
              src="/logo-icon.png"
              width={20}
            />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">Big Eye</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300"
            href="/creditos"
          >
            <Coins className="h-3 w-3 text-cyan-400" />
            <span>{me?.balance ?? 0} cr</span>
          </Link>
          <button
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ReUI Style Dark Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-zinc-800/80 bg-[#09090b] transition-transform duration-200 md:static md:h-full md:w-64 md:shrink-0 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-1 flex-col overflow-y-auto min-h-0 [scrollbar-width:thin] [scrollbar-color:#27272a_transparent]">
          {/* Top Brand Header */}
          <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 px-4">
            <Link
              className="flex items-center gap-2.5 transition hover:opacity-90"
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-900 p-1 shadow-sm">
                <Image
                  alt="Big Eye"
                  className="h-4.5 w-auto object-contain"
                  height={22}
                  priority
                  src="/logo-icon.png"
                  width={22}
                />
              </div>
              <span className="text-sm font-semibold tracking-tight text-zinc-100">Big Eye</span>
            </Link>

            {/* Header More Options Menu */}
            <div className="relative" ref={headerMenuRef}>
              <button
                aria-label="Opções da plataforma"
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800/80 hover:text-zinc-200"
                onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                type="button"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {headerMenuOpen && (
                <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-zinc-800 bg-[#121215] p-1.5 shadow-xl shadow-black/60">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Ações Rápidas
                  </div>
                  <div className="border-t border-zinc-800/80 my-1" />
                  <Link
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    href="/catalogo"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Search className="h-3.5 w-3.5 text-zinc-400" />
                    Catálogo de Consultas
                  </Link>
                  <Link
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    href="/creditos"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Coins className="h-3.5 w-3.5 text-zinc-400" />
                    Comprar Créditos
                  </Link>
                  <Link
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    href="/dashboard#api-status"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Server className="h-3.5 w-3.5 text-zinc-400" />
                    Status da API
                  </Link>
                  {me?.role === 'admin' ? (
                    <Link
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      href="/admin"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                      Backoffice Admin
                    </Link>
                  ) : null}
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white text-left"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setDocsModalOpen(true);
                    }}
                    type="button"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                    Documentação
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="px-3 pt-3 pb-1">
            <Link
              className="group relative flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-800/80 to-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 shadow-sm transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
              href="/catalogo"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400 transition group-hover:scale-110" />
                <span>Nova Consulta</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
            </Link>
          </div>

          {/* Platform Nav Section */}
          <div className="mt-2 px-3 py-1">
            <p className="px-3 py-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Plataforma
            </p>

            <nav aria-label="Navegação da plataforma" className="mt-1 space-y-0.5">
              {/* Visão Geral */}
              {(() => {
                const isActive = pathname === '/dashboard';
                return (
                  <Link
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'bg-zinc-800/80 text-zinc-100 font-semibold'
                        : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                    }`}
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2.5">
                      <Home className={`h-4 w-4 ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`} />
                      <span>Visão Geral</span>
                    </div>
                  </Link>
                );
              })()}

              {/* Consultas & Módulos with Collapsible Tree */}
              {(() => {
                const isSectionActive =
                  pathname === '/catalogo' || pathname.startsWith('/consulta/');
                return (
                  <div>
                    <button
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                        isSectionActive && !queriesOpen
                          ? 'bg-zinc-800/80 text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                      }`}
                      onClick={() => setQueriesOpen(!queriesOpen)}
                      type="button"
                    >
                      <div className="flex items-center gap-2.5">
                        <Zap className="h-4 w-4 text-zinc-400" />
                        <span>Consultas & Módulos</span>
                      </div>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${
                          queriesOpen ? '' : '-rotate-90'
                        }`}
                      />
                    </button>

                    {queriesOpen && (
                      <div className="relative mt-1 ml-5 pl-3 border-l border-zinc-800 space-y-0.5">
                        <Link
                          className={`block rounded-md px-2.5 py-1.5 text-xs transition ${
                            pathname === '/catalogo'
                              ? 'bg-zinc-800/80 text-zinc-100 font-medium'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                          }`}
                          href="/catalogo"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Catálogo Completo
                        </Link>
                        <Link
                          className="block rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition"
                          href="/dashboard#queries"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Histórico de Execuções
                        </Link>
                        <Link
                          className="block rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition"
                          href="/catalogo?categoria=pessoais"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Pessoas & CPF
                        </Link>
                        <Link
                          className="block rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition"
                          href="/catalogo?categoria=veiculares"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Veículos & DETRAN
                        </Link>
                        <Link
                          className="block rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition"
                          href="/catalogo?categoria=empresariais"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Empresas & CNPJ
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Carteira & Créditos */}
              {(() => {
                const isActive = pathname === '/creditos';
                return (
                  <Link
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'bg-zinc-800/80 text-zinc-100 font-semibold'
                        : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                    }`}
                    href="/creditos"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2.5">
                      <Coins className="h-4 w-4 text-cyan-400" />
                      <span>Carteira & Créditos</span>
                    </div>
                    <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 border border-zinc-700/50">
                      {me?.balance ?? 0} cr
                    </span>
                  </Link>
                );
              })()}

              {/* Infraestrutura & Status */}
              <Link
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 transition"
                href="/dashboard#api-status"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center gap-2.5">
                  <Server className="h-4 w-4 text-zinc-400" />
                  <span>Infraestrutura & Status</span>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-800/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              </Link>

              {/* Segurança & Backoffice Admin */}
              <Link
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                  pathname.startsWith('/admin')
                    ? 'bg-zinc-800/80 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                }`}
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-zinc-400" />
                  <span>Segurança & Admin</span>
                </div>
                {me?.role === 'admin' ? (
                  <span className="rounded bg-purple-950/80 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 border border-purple-800/50">
                    Admin
                  </span>
                ) : null}
              </Link>
            </nav>
          </div>

          {/* Resources / Conectores & Bases Section (Closed by default) */}
          <div className="mt-3 px-3 py-1">
            <button
              className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase hover:text-zinc-300"
              onClick={() => setResourcesOpen(!resourcesOpen)}
              type="button"
            >
              <span>Conectores & Recursos</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${
                  resourcesOpen ? '' : '-rotate-90'
                }`}
              />
            </button>

            {resourcesOpen && (
              <div className="mt-1 space-y-0.5">
                {resources.map((item) => (
                  <Link
                    className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 transition"
                    href={item.href}
                    key={item.name}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.tag ? (
                      <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400 border border-zinc-700/50">
                        {item.tag}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Utility: Documentation */}
          <div className="mt-auto px-3 pt-3 pb-2 border-t border-zinc-800/80">
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 transition text-left"
              onClick={() => setDocsModalOpen(true)}
              type="button"
            >
              <BookOpen className="h-4 w-4 text-zinc-400" />
              <span>Documentação</span>
            </button>
          </div>
        </div>

        {/* User Profile Footer Card */}
        <div className="relative shrink-0 border-t border-zinc-800/80 p-3" ref={userMenuRef}>
          <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-2 transition hover:border-zinc-700">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-200 border border-zinc-700/60">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-200">{userName}</p>
                <p className="truncate text-[10px] text-zinc-500">{userEmail}</p>
              </div>
            </div>

            <button
              aria-label="Menu do operador"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* User Popover Menu */}
          {userMenuOpen && (
            <div className="absolute bottom-16 left-3 right-3 z-50 rounded-xl border border-zinc-800 bg-[#121215] p-2 shadow-2xl shadow-black/80">
              <div className="px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-400">Saldo Atual</span>
                  <span className="text-xs font-bold text-white">{me?.balance ?? 0} cr</span>
                </div>
              </div>

              <div className="my-1 border-t border-zinc-800" />

              <Link
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                href="/creditos"
                onClick={() => setUserMenuOpen(false)}
              >
                <Coins className="h-3.5 w-3.5 text-cyan-400" />
                Carteira & Pacotes
              </Link>

              <Link
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                href="/dashboard#api-status"
                onClick={() => setUserMenuOpen(false)}
              >
                <Server className="h-3.5 w-3.5 text-zinc-400" />
                Status dos Serviços
              </Link>

              {me?.role === 'admin' ? (
                <Link
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  href="/admin"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                  Backoffice Admin
                </Link>
              ) : null}

              <div className="my-1 border-t border-zinc-800" />

              <button
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50 text-left"
                disabled={isSigningOut}
                onClick={() => void signOut()}
                type="button"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair da conta</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Breadcrumb Bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-[#09090b]/80 px-6 backdrop-blur-sm">
          {/* Breadcrumb Trail */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
            {breadcrumbs.map((crumb, idx) => (
              <div className="flex items-center gap-2" key={crumb.href + idx}>
                {idx > 0 && <span className="text-zinc-600">›</span>}
                {crumb.current ? (
                  <span className="font-medium text-zinc-200">{crumb.label}</span>
                ) : (
                  <Link
                    className="text-zinc-400 hover:text-zinc-200 transition"
                    href={crumb.href}
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Right Header Badges */}
          <div className="flex items-center gap-3">
            <AthenasStatusBadge />

            <Link
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/80 transition"
              href="/creditos"
              title="Recarregar saldo"
            >
              <Coins className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-semibold text-zinc-200">{me?.balance ?? 0}</span>
              <span className="text-[10px] text-zinc-500">cr</span>
            </Link>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 min-w-0 bg-[#09090b]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Modal: Documentation */}
      {docsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setDocsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0f0f12] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Documentação Big Eye</h3>
              </div>
              <button
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                onClick={() => setDocsModalOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-zinc-400 leading-relaxed">
              <p>
                A Big Eye conecta operadores aos principais serviços de busca cadastral,
                veicular e societária em tempo real via rede oficial e bases integradas da Big Eye.
              </p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                <p className="font-semibold text-zinc-200">Políticas de Cobrança:</p>
                <p className="mt-1 text-zinc-400">
                  Os créditos só são deduzidos quando a consulta é completada com sucesso. Em caso
                  de indisponibilidade dos nós upstream, o saldo é automaticamente reembolsado.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                <p className="font-semibold text-zinc-200">Status & Disponibilidade:</p>
                <p className="mt-1 text-zinc-400">
                  Acompanhe em tempo real a latência e o uptime de cada conector na seção{' '}
                  <Link
                    className="text-cyan-400 hover:underline"
                    href="/dashboard#api-status"
                    onClick={() => setDocsModalOpen(false)}
                  >
                    Infraestrutura & Status
                  </Link>.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition"
                onClick={() => setDocsModalOpen(false)}
                type="button"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
