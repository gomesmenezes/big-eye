'use client';

import { useMemo, useState, type FormEvent } from 'react';

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
  maxLength?: number;
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
    <form className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={(event) => void submit(event)}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-950">Dados da consulta</h2>
        <p className="mt-1 text-sm text-slate-500">Preencha os campos abaixo para consumir {module.custoCreditos} crédito{module.custoCreditos === 1 ? '' : 's'}.</p>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <label className="block text-sm font-medium text-slate-700" htmlFor={`query-${field.name}`} key={field.name}>
            {field.label}
            <input
              autoComplete="off"
              className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-petrol-500 focus:ring-2 focus:ring-petrol-100 disabled:bg-slate-100 ${field.name === 'cpf' ? 'font-mono tracking-wide' : ''}`}
              disabled={disabled || isSubmitting}
              id={`query-${field.name}`}
              inputMode={field.inputMode}
              maxLength={field.maxLength}
              onChange={(event) => updateValue(field.name, event.target.value)}
              placeholder={field.hint}
              required
              type="text"
              value={values[field.name] ?? ''}
            />
          </label>
        ))}
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p> : null}
      <button
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-petrol-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-petrol-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Enviando consulta...' : 'Consultar agora'}
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
    }];
  }

  return [{
    name: 'value',
    label: 'Valor da consulta',
    hint: 'Informe o valor solicitado pelo módulo',
    inputMode: 'text',
  }];
}
