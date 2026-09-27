'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { MeDTOType } from '@big-eye/contracts';

import { apiFetchPath, type ModuleDTOType } from '../../../lib/api';

const categoryLabels: Record<ModuleDTOType['categoria'], string> = {
  pessoais: 'Pessoais',
  veiculares: 'Veiculares',
  empresariais: 'Empresariais',
  web: 'Web',
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
          setError('Não foi possível carregar o catálogo agora.');
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

  const groupedModules = useMemo(
    () => categoryOrder.map((category) => ({
      category,
      modules: modules.filter((module) => module.categoria === category),
    })).filter(({ modules: categoryModules }) => categoryModules.length > 0),
    [modules],
  );

  if (isLoading) {
    return <CatalogFrame><div className="h-8 w-56 animate-pulse rounded bg-slate-200" /></CatalogFrame>;
  }

  if (error) {
    return <CatalogFrame><p className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800" role="alert">{error}</p></CatalogFrame>;
  }

  return (
    <CatalogFrame>
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-petrol-600">Catálogo</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Escolha sua consulta</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Consulte dados pessoais, empresariais, veiculares e referências públicas com um crédito por consulta.
          </p>
        </div>
        {me ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <span className="text-slate-500">Seu saldo</span>{' '}
            <strong className="text-slate-950">{me.balance} crédito{me.balance === 1 ? '' : 's'}</strong>
          </div>
        ) : null}
      </section>

      <div className="mt-10 space-y-12">
        {groupedModules.map(({ category, modules: categoryModules }) => (
          <section key={category}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{categoryLabels[category]}</h2>
                <p className="mt-1 text-sm text-slate-500">{categoryModules.length} módulo{categoryModules.length === 1 ? '' : 's'} disponíveis no catálogo.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryModules.map((module) => <ModuleCard key={module.slug} module={module} hasCredits={(me?.balance ?? 0) > 0} />)}
            </div>
          </section>
        ))}
      </div>
    </CatalogFrame>
  );
}

function ModuleCard({ module, hasCredits }: { module: ModuleDTOType; hasCredits: boolean }) {
  return (
    <article className="flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">{module.nome}</h3>
            {module.destaque ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">Especial</span> : null}
          </div>
          <p className="mt-1 font-mono text-xs font-medium uppercase tracking-wide text-slate-400">{module.slug}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {module.custoCreditos} crédito{module.custoCreditos === 1 ? '' : 's'}
        </span>
      </div>
      <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">{module.descricao}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {module.tags.map((tag) => <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600" key={tag}>{tag}</span>)}
        <span className="rounded-md bg-petrol-50 px-2 py-1 text-xs text-petrol-700">{module.mode === 'async' ? 'Resultado acompanhado' : 'Resultado imediato'}</span>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        {module.implemented && hasCredits ? (
          <Link className="inline-flex w-full items-center justify-center rounded-lg bg-petrol-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-petrol-700" href={`/consulta/${module.slug}`}>
            Consultar módulo
          </Link>
        ) : module.implemented ? (
          <Link className="inline-flex w-full items-center justify-center rounded-lg border border-petrol-200 bg-petrol-50 px-3 py-2.5 text-sm font-semibold text-petrol-700 hover:bg-petrol-100" href="/creditos">
            Assine para acessar
          </Link>
        ) : (
          <span className="inline-flex w-full items-center justify-center rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-500">
            Disponível em breve
          </span>
        )}
      </div>
    </article>
  );
}

function CatalogFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>;
}
