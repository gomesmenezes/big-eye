'use client';

import {
  UserCheck,
  Car,
  Building2,
  Globe,
  Coins,
  Search,
  Filter,
  Fingerprint,
  Zap,
  Clock,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { MeDTOType } from '@big-eye/contracts';

import { apiFetchPath, type ModuleDTOType } from '../../../lib/api';

const categoryLabels: Record<ModuleDTOType['categoria'], string> = {
  pessoais: 'Identidade & Pessoas Físicas',
  veiculares: 'Veículos, Frotas & Trânsito',
  empresariais: 'Empresarial, QSA & Receita',
  web: 'Inteligência Web & OSINT',
};

const categoryIcons: Record<ModuleDTOType['categoria'], typeof UserCheck> = {
  pessoais: Fingerprint,
  veiculares: Car,
  empresariais: Building2,
  web: Globe,
};

const categoryOrder: ModuleDTOType['categoria'][] = [
  'pessoais',
  'veiculares',
  'empresariais',
  'web',
];

export default function CatalogPage() {
  const [modules, setModules] = useState<ModuleDTOType[]>([]);
  const [me, setMe] = useState<MeDTOType>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      try {
        const [catalog, profile] = await Promise.all([
          apiFetchPath('/modules'),
          apiFetchPath('/me'),
        ]);

        if (active) {
          setModules(catalog);
          setMe(profile);
        }
      } catch {
        if (active) {
          setError('Não foi possível carregar o catálogo de Chamadas/Consultas.');
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

  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const matchesCategory =
        selectedCategory === 'all' || m.categoria === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        m.nome.toLowerCase().includes(query) ||
        m.slug.toLowerCase().includes(query) ||
        m.descricao.toLowerCase().includes(query) ||
        m.tags.some((t) => t.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [modules, selectedCategory, searchQuery]);

  const groupedModules = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          modules: filteredModules.filter((module) => module.categoria === category),
        }))
        .filter(({ modules: categoryModules }) => categoryModules.length > 0),
    [filteredModules],
  );

  if (isLoading) {
    return (
      <CatalogFrame>
        <div className="space-y-4 animate-pulse">
          <div className="h-10 w-64 rounded-xl bg-[#0d121c]" />
          <div className="h-12 w-full rounded-2xl bg-[#0d121c]" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div className="h-44 rounded-2xl bg-[#0d121c]" key={i} />
            ))}
          </div>
        </div>
      </CatalogFrame>
    );
  }

  if (error) {
    return (
      <CatalogFrame>
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 text-xs text-red-300">
          <p>{error}</p>
          <button
            className="mt-3 font-bold underline text-red-200 hover:text-white"
            onClick={() => window.location.reload()}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      </CatalogFrame>
    );
  }

  return (
    <CatalogFrame>
      {/* Catalog Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              Matriz de Chamadas & Conectores
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Catálogo de Consultas
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-zinc-400">
            Selecione uma fonte para pesquisar dados estruturados. O débito é transparente e unitário por consulta.
          </p>
        </div>

        {me ? (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2">
            <Coins className="h-4 w-4 text-cyan-400" />
            <div className="text-xs">
              <span className="text-zinc-400">Saldo: </span>
              <strong className="font-semibold text-white">{me.balance} créditos</strong>
            </div>
            <Link
              className="ml-2 rounded-md bg-zinc-800 border border-zinc-700/60 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition"
              href="/creditos"
            >
              + Recarregar
            </Link>
          </div>
        ) : null}
      </section>

      {/* Search and Category Filter */}
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            className="w-full rounded-xl border border-zinc-800/80 bg-zinc-900/40 py-2.5 pr-4 pl-10 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-zinc-600 focus:bg-zinc-900"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar conector por nome, tag ou termo de consulta..."
            type="text"
            value={searchQuery}
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-zinc-800 text-white border border-zinc-700/80'
                : 'border border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
            }`}
            onClick={() => setSelectedCategory('all')}
            type="button"
          >
            TODOS ({modules.length})
          </button>
          {categoryOrder.map((cat) => {
            const count = modules.filter((m) => m.categoria === cat).length;
            return (
              <button
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-zinc-800 text-white border border-zinc-700/80'
                    : 'border border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                }`}
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                type="button"
              >
                <span>{cat.toUpperCase()}</span>
                <span className="ml-1 opacity-50">({count})</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Module Categories */}
      <div className="mt-8 space-y-10">
        {groupedModules.length === 0 ? (
          <div className="rounded-2xl border border-[#1a2233] bg-[#0c1018] p-12 text-center">
            <Filter className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-xs font-bold text-white">Nenhuma Chamada/Consulta encontrada</p>
            <p className="mt-1 text-[11px] text-slate-500">Tente buscar por outro termo.</p>
            <button
              className="mt-4 rounded-xl border border-[#232f48] bg-[#121826] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              type="button"
            >
              Resetar busca
            </button>
          </div>
        ) : (
          groupedModules.map(({ category, modules: categoryModules }) => {
            const CategoryIcon = categoryIcons[category];

            return (
              <section key={category}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-950/70 text-cyan-400 border border-cyan-800/40">
                    <CategoryIcon className="h-4 w-4" />
                  </div>
                  <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                    {categoryLabels[category]}
                  </h2>
                  <span className="rounded-full border border-[#1a2436] bg-[#0f1422] px-2 py-0.5 text-[9px] font-bold text-slate-400">
                    {categoryModules.length}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryModules.map((module) => {
                    const hasCredits = (me?.balance ?? 0) >= module.custoCreditos;

                    return (
                      <div
                        className="group relative flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/60"
                        key={module.slug}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-semibold text-zinc-300 font-mono">
                              {module.slug}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                                <Coins className="h-3 w-3 text-cyan-400" />
                                {module.custoCreditos} cr
                              </span>
                            </div>
                          </div>

                          <h3 className="mt-2 text-sm font-semibold text-zinc-100 group-hover:text-white transition">
                            {module.nome}
                          </h3>

                          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                            {module.descricao}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-1">
                            {module.tags.map((tag) => (
                              <span
                                className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400"
                                key={tag}
                              >
                                #{tag}
                              </span>
                            ))}

                            <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-800/40 px-1.5 py-0.5 text-[9px] font-medium text-zinc-300">
                              {module.mode === 'async' ? (
                                <>
                                  <Clock className="h-3 w-3" />
                                  Acompanhado
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3 w-3" />
                                  Instantâneo
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-zinc-800/80 pt-3">
                          {module.implemented && hasCredits ? (
                            <Link
                              className="inline-flex w-full items-center justify-between rounded-lg bg-zinc-800/80 border border-zinc-700/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
                              href={`/consulta/${module.slug}`}
                            >
                              <span>Consultar</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : module.implemented ? (
                            <Link
                              className="inline-flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                              href="/creditos"
                            >
                              <span>Comprar créditos</span>
                              <Coins className="h-3.5 w-3.5 text-cyan-400" />
                            </Link>
                          ) : (
                            <span className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-500">
                              Disponível em breve
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </CatalogFrame>
  );
}

function CatalogFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="space-y-6">{children}</div>;
}
