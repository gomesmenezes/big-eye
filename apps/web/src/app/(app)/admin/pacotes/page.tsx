'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { AdminError, AdminLoading, AdminPage, AdminStatus, adminErrorMessage } from '../../../../components/admin/admin-shell';
import {
  formatCurrency,
  getText,
  isRecord,
  readItems,
  readNextCursor,
  type AdminPackage,
} from '../../../../components/admin/admin-types';
import { OrbLoader } from '../../../../components/orb-loader';
import { apiFetch } from '../../../../lib/api';

type PackageDraft = {
  slug: string;
  credits: string;
  priceCents: string;
  active: boolean;
  sort: string;
};

const emptyDraft: PackageDraft = {
  slug: '',
  credits: '10',
  priceCents: '1000',
  active: true,
  sort: '0',
};

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [editing, setEditing] = useState<AdminPackage>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [runningId, setRunningId] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function loadPackages(cursor?: string, append = false): Promise<void> {
    setIsLoading(!append);
    setIsLoadingMore(append);
    setError(undefined);
    try {
      const params = new URLSearchParams({ includeInactive: 'true' });
      if (cursor) params.set('cursor', cursor);
      const suffix = `?${params.toString()}`;
      const response = await apiFetch<unknown>(`/admin/packages${suffix}`);
      const items = readItems<AdminPackage>(response, ['items', 'packages', 'data']).map((item) => normalizePackage(item));
      setPackages((current) => append ? [...current, ...items] : items);
      setNextCursor(readNextCursor(response));
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível carregar os pacotes.'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPackages();
  }, []);

  function beginCreate(): void {
    setEditing(undefined);
    setIsFormOpen(true);
    setMessage(undefined);
  }

  function beginEdit(creditPackage: AdminPackage): void {
    setEditing(creditPackage);
    setIsFormOpen(true);
    setMessage(undefined);
  }

  async function savePackage(draft: PackageDraft): Promise<void> {
    setRunningId(editing?.id ?? 'new');
    setError(undefined);
    setMessage(undefined);
    const body = {
      slug: draft.slug.trim(),
      credits: Number(draft.credits),
      priceCents: Number(draft.priceCents),
      active: draft.active,
      sort: Number(draft.sort),
    };

    try {
      const response = await apiFetch<unknown>(editing ? `/admin/packages/${editing.id}` : '/admin/packages', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      const saved = normalizePackage(response, {
        ...(editing ?? {}),
        id: editing?.id ?? '',
        currency: 'BRL',
        slug: body.slug,
        credits: body.credits,
        priceCents: body.priceCents,
        active: body.active,
        sort: body.sort,
      });
      setPackages((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setEditing(undefined);
      setIsFormOpen(false);
      setMessage(editing ? 'Pacote atualizado. O novo preço já está disponível no catálogo.' : 'Pacote criado.');
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível salvar este pacote.'));
    } finally {
      setRunningId(undefined);
    }
  }

  async function togglePackage(creditPackage: AdminPackage): Promise<void> {
    const nextActive = creditPackage.active === false;
    if (!window.confirm(`${nextActive ? 'Ativar' : 'Desativar'} o pacote ${creditPackage.slug}?`)) {
      return;
    }

    setRunningId(creditPackage.id);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await apiFetch<unknown>(`/admin/packages/${creditPackage.id}`, nextActive
        ? { method: 'PATCH', body: JSON.stringify({ active: true }) }
        : { method: 'DELETE' });
      const updated = normalizePackage(response, { ...creditPackage, active: nextActive });
      setPackages((current) => current.map((item) => item.id === creditPackage.id ? updated : item));
      setMessage(nextActive ? 'Pacote ativado.' : 'Pacote desativado.');
    } catch (error) {
      setError(adminErrorMessage(error, 'Não foi possível atualizar este pacote.'));
    } finally {
      setRunningId(undefined);
    }
  }

  return (
    <AdminPage
      actions={<button className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500" onClick={beginCreate} type="button">Novo pacote</button>}
      description="Mantenha os pacotes de créditos e preços exibidos no catálogo de compra."
      title="Pacotes"
    >
      {error ? <div className="mb-5"><AdminError message={error} /></div> : null}
      {message ? <p className="mb-5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-300" role="status">{message}</p> : null}
      {isFormOpen ? <PackageForm initial={editing} isSaving={runningId === (editing?.id ?? 'new')} onCancel={() => { setIsFormOpen(false); setEditing(undefined); }} onSave={(draft) => void savePackage(draft)} key={editing?.id ?? 'new'} /> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#1c2436] bg-[#0d121c] shadow-card">
        <div className="border-b border-[#1c2436] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400" />
            <h3 className="font-bold text-white">Pacotes disponíveis</h3>
          </div>
        </div>
        {isLoading ? <div className="p-5"><AdminLoading /></div> : null}
        {!isLoading && packages.length === 0 ? <p className="p-5 text-xs text-slate-500">Nenhum pacote cadastrado.</p> : null}
        {!isLoading && packages.length > 0 ? (
          <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#1c2436] bg-[#111622] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold" scope="col">Pacote</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Créditos</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Preço</th>
                  <th className="px-5 py-3 font-semibold" scope="col">Status</th>
                  <th className="px-5 py-3" scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2436]">
                {packages.map((creditPackage) => (
                  <tr className="hover:bg-[#121824] transition" key={creditPackage.id}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-white">{creditPackage.slug}</p>
                      <p className="mt-1 text-[11px] text-slate-400">ordem {creditPackage.sort ?? 0}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">{creditPackage.credits}</td>
                    <td className="px-5 py-4 font-bold text-cyan-300">{formatCurrency(creditPackage.priceCents)}</td>
                    <td className="px-5 py-4"><AdminStatus status={creditPackage.active === false ? 'suspended' : 'active'} /></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3 text-xs">
                        <button className="font-bold text-cyan-400 transition hover:text-cyan-300" onClick={() => beginEdit(creditPackage)} type="button">Editar</button>
                        <button className="inline-flex items-center gap-1.5 font-bold text-red-400 transition hover:text-red-300 disabled:opacity-50" disabled={runningId === creditPackage.id} onClick={() => void togglePackage(creditPackage)} type="button">{runningId === creditPackage.id ? (<><OrbLoader color="#f87171" size={20} state="working" /><span>Processando...</span></>) : (creditPackage.active === false ? 'Ativar' : 'Desativar')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor ? <div className="border-t border-[#1c2436] px-5 py-4 text-center"><button className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 transition hover:text-cyan-300 disabled:cursor-wait disabled:opacity-60" disabled={isLoadingMore} onClick={() => void loadPackages(nextCursor, true)} type="button">{isLoadingMore ? (<><OrbLoader color="#22d3ee" size={20} state="working" /><span>Carregando...</span></>) : 'Carregar mais'}</button></div> : null}
          </>
        ) : null}
      </section>
    </AdminPage>
  );
}

function PackageForm({
  initial,
  isSaving,
  onSave,
  onCancel,
}: Readonly<{
  initial?: AdminPackage;
  isSaving: boolean;
  onSave: (draft: PackageDraft) => void;
  onCancel: () => void;
}>) {
  const [draft, setDraft] = useState<PackageDraft>(() => initial ? {
    slug: initial.slug,
    credits: String(initial.credits),
    priceCents: String(initial.priceCents),
    active: initial.active !== false,
    sort: String(initial.sort ?? 0),
  } : emptyDraft);
  const [formError, setFormError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const credits = Number(draft.credits);
    const priceCents = Number(draft.priceCents);
    const sort = Number(draft.sort);
    if (!draft.slug.trim() || !Number.isInteger(credits) || credits < 1 || !Number.isInteger(priceCents) || priceCents < 1 || !Number.isInteger(sort)) {
      setFormError('Preencha slug, créditos, preço positivo em centavos e ordem com valores válidos.');
      return;
    }
    setFormError(undefined);
    onSave(draft);
  }

  return (
    <form className="rounded-2xl border border-cyan-800/40 bg-[#0d121c] p-6 shadow-card" onSubmit={submit}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-white">{initial ? 'Editar pacote' : 'Novo pacote'}</h3>
          <p className="mt-1 text-xs text-slate-400">O preço deve ser informado em centavos de BRL.</p>
        </div>
        <button className="text-xs font-bold text-slate-400 hover:text-white transition" onClick={onCancel} type="button">Cancelar</button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Slug
          <input className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} value={draft.slug} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Créditos
          <input className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" inputMode="numeric" onChange={(event) => setDraft((current) => ({ ...current, credits: event.target.value }))} value={draft.credits} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Preço (centavos)
          <input className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" inputMode="numeric" onChange={(event) => setDraft((current) => ({ ...current, priceCents: event.target.value }))} value={draft.priceCents} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Ordem
          <input className="mt-1.5 w-full rounded-xl border border-[#1c2436] bg-[#121824] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" inputMode="numeric" onChange={(event) => setDraft((current) => ({ ...current, sort: event.target.value }))} value={draft.sort} />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
        <input checked={draft.active} className="rounded border-[#1c2436] bg-[#121824] text-cyan-500 focus:ring-cyan-500/50" onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
        Disponível para compra
      </label>
      {formError ? <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300" role="alert">{formError}</p> : null}
      <button className="inline-flex items-center justify-center gap-1.5 mt-5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500 disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? (<><OrbLoader color="#ffffff" size={20} state="working" /><span>Salvando...</span></>) : 'Salvar pacote'}</button>
    </form>
  );
}

function normalizePackage(value: unknown, fallback?: AdminPackage): AdminPackage {
  const root = isRecord(value) && isRecord(value.data) ? value.data : value;
  const source = isRecord(root) && isRecord(root.package) ? root.package : root;
  const base = isRecord(source) ? source : {};

  return {
    ...(fallback ?? {}),
    id: getText(base.id, fallback?.id ?? ''),
    slug: getText(base.slug, fallback?.slug ?? ''),
    credits: typeof base.credits === 'number' ? base.credits : fallback?.credits ?? 0,
    priceCents: typeof base.priceCents === 'number' ? base.priceCents : fallback?.priceCents ?? 0,
    currency: base.currency === 'BRL' ? 'BRL' : fallback?.currency ?? 'BRL',
    ...(typeof base.active === 'boolean' ? { active: base.active } : {}),
    ...(typeof base.sort === 'number' ? { sort: base.sort } : {}),
  };
}
