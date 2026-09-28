'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Search, Loader2, AlertCircle, Coins, Hash } from 'lucide-react';

import type { ModuleDTOType } from '../lib/api';

type QueryFormProps = {
  module: ModuleDTOType;
  disabled?: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
};

type Field = {
  name: string;
  label: string;
  hint: string;
  inputMode?: 'numeric' | 'text';
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  normalize?: (value: string) => string;
  validate?: (value: string) => string | undefined;
};

export function QueryForm({ module, disabled = false, onSubmit }: QueryFormProps) {
  const fields = useMemo(() => fieldsForModule(module), [module]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, ''])),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  function updateValue(name: string, value: string): void {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);

    const input = Object.fromEntries(
      fields.map((field) => [field.name, values[field.name]?.trim() ?? '']),
    );
    const missingField = fields.find((field) => !input[field.name]);

    if (missingField) {
      setError(`Informe ${missingField.label.toLowerCase()} para continuar.`);
      return;
    }

    const invalidField = fields.find((field) => field.validate?.(input[field.name] ?? ''));
    if (invalidField) {
      setError(invalidField.validate?.(input[invalidField.name] ?? '') ?? 'Confira os dados informados.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(input);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível iniciar a consulta.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-busy={disabled || isSubmitting}
      className="rounded-2xl border border-[#1e202f] bg-[#12131d] p-6 shadow-card sm:p-8"
      onSubmit={(event) => void submit(event)}
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Dados da consulta</h2>
          <p className="mt-1 text-xs text-slate-400">
            Preencha os campos abaixo para consumir {module.custoCreditos} crédito{module.custoCreditos === 1 ? '' : 's'}.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-800/50 bg-violet-950/60 px-3 py-1 text-xs font-bold text-violet-300">
          <Coins className="h-3 w-3" />
          {module.custoCreditos} crédito{module.custoCreditos === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor={`query-${field.name}`}>
              {field.label}
            </label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Hash className="h-4 w-4" />
              </div>
              <input
                aria-describedby={`query-${field.name}-hint`}
                autoComplete="off"
                className={`w-full rounded-xl border border-[#2a2d40] bg-[#181926] py-3 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:bg-[#12131d] disabled:cursor-not-allowed ${
                  field.name === 'cpf' ? 'font-mono tracking-wider' : ''
                }`}
                disabled={disabled || isSubmitting}
                id={`query-${field.name}`}
                inputMode={field.inputMode}
                maxLength={field.maxLength}
                minLength={field.minLength}
                onChange={(event) => updateValue(field.name, field.normalize?.(event.target.value) ?? event.target.value)}
                pattern={field.pattern}
                placeholder={field.hint}
                required
                type="text"
                value={values[field.name] ?? ''}
              />
            </div>
            <span className="mt-1.5 block text-[11px] font-normal text-slate-500" id={`query-${field.name}-hint`}>
              {field.hint}
            </span>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/30 p-3.5 text-xs text-red-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-glow-sm transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Enviando consulta...</span>
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            <span>Consultar agora</span>
          </>
        )}
      </button>
    </form>
  );
}

function fieldsForModule(module: ModuleDTOType): Field[] {
  if (module.tags.some((tag) => tag.toLowerCase() === 'cpf') || module.slug.includes('cpf')) {
    return [{
      name: 'cpf',
      label: 'CPF',
      hint: 'Digite 11 números, sem pontuação',
      inputMode: 'numeric',
      maxLength: 11,
      minLength: 11,
      normalize: (value) => value.replace(/\D/gu, '').slice(0, 11),
      pattern: '\\d{11}',
      validate: (value) => /^\d{11}$/u.test(value) ? undefined : 'Informe um CPF com 11 números.',
    }];
  }

  return [{
    name: 'value',
    label: 'Valor da consulta',
    hint: 'Informe o valor solicitado para Chamadas/Consultas',
    inputMode: 'text',
  }];
}
