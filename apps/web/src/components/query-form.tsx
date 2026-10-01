'use client';

import { Search, AlertCircle, Coins, Hash } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import type { ModuleDTOType } from '../lib/api';

import { OrbLoader } from './orb-loader';

type QueryFormProps = {
  module: ModuleDTOType;
  disabled?: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
};

type Field = {
  name: string;
  label: string;
  hint: string;
  required?: boolean;
  type?: 'email' | 'text' | 'url';
  inputMode?: 'numeric' | 'text';
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  normalize?: (value: string) => string;
  serialize?: (value: string) => unknown;
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
    const missingField = fields.find((field) => field.required !== false && !input[field.name]);

    if (missingField) {
      setError(`Informe ${missingField.label.toLowerCase()} para continuar.`);
      return;
    }

    const invalidField = fields.find((field) => {
      const value = input[field.name] ?? '';
      return value.length > 0 && Boolean(field.validate?.(value));
    });
    if (invalidField) {
      setError(invalidField.validate?.(input[invalidField.name] ?? '') ?? 'Confira os dados informados.');
      return;
    }

    const submittedInput = Object.fromEntries(
      fields
        .filter((field) => field.required !== false || input[field.name])
        .map((field) => [field.name, field.serialize?.(input[field.name]) ?? input[field.name]]),
    );

    setIsSubmitting(true);

    try {
      await onSubmit(submittedInput);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível iniciar a consulta.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-busy={disabled || isSubmitting}
      className="rounded-2xl border border-[#1c2436] bg-[#0d121c] p-6 shadow-card sm:p-8"
      onSubmit={(event) => void submit(event)}
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Dados da consulta</h2>
          <p className="mt-1 text-xs text-slate-400">
            Preencha os campos abaixo para consumir {module.custoCreditos} crédito{module.custoCreditos === 1 ? '' : 's'}.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-800/50 bg-cyan-950/60 px-3 py-1 text-xs font-bold text-cyan-300">
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
                className={`w-full rounded-xl border border-[#1c2436] bg-[#121824] py-3 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-[#0d121c] disabled:cursor-not-allowed ${
                  field.name === 'cpf' ? 'tracking-wider' : ''
                }`}
                disabled={disabled || isSubmitting}
                id={`query-${field.name}`}
                inputMode={field.inputMode}
                maxLength={field.maxLength}
                minLength={field.minLength}
                onChange={(event) => updateValue(field.name, field.normalize?.(event.target.value) ?? event.target.value)}
                pattern={field.pattern}
                placeholder={field.hint}
                required={field.required !== false}
                type={field.type ?? 'text'}
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
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-glow transition hover:from-cyan-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <OrbLoader color="#a5f3fc" size={20} state="searching" />
            <span>Enviando consulta...</span>
          </span>
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
  const slug = module.slug.toLowerCase();

  if (CPF_MODULES.has(slug) || module.tags.some((tag) => tag.toLowerCase() === 'cpf') || slug.includes('cpf')) {
    return [cpfField()];
  }

  if (CNPJ_MODULES.has(slug) || module.tags.some((tag) => tag.toLowerCase() === 'cnpj')) {
    return [
      cnpjField(),
      ...(slug === 'cnpj-funcionarios' ? employeeFilterFields() : []),
    ];
  }

  switch (slug) {
    case 'email-reverso':
      return [emailField()];
    case 'telefone-reverso':
      return [phoneField()];
    case 'nome-abreviado':
      return [queryField('Nome ou abreviação', 'Digite o nome parcial ou abreviado'), ...nameSearchFields()];
    case 'nome-completo':
      return [queryField('Nome completo', 'Digite o nome completo'), ...nameSearchFields()];
    case 'endereco-consulta':
      return [queryField('Endereço', 'Digite o endereço completo ou parcial'), ...paginationFields(50)];
    case 'placa-basico':
      return [plateField()];
    case 'chassi-consulta':
      return [chassiField()];
    case 'renavam-consulta':
      return [renavamField()];
    case 'logins-vazados':
      return [leakedLoginsQueryField(), ...leakedLoginsFilterFields()];
    case 'pis-pasep':
      return [pisField()];
    case 'ip-geolocalizacao':
      return [
        {
          name: 'ip',
          label: 'Endereço IP',
          hint: 'Ex.: 8.8.8.8 ou um endereço IPv6 válido',
          validate: (value) => isValidIp(value) ? undefined : 'Informe um endereço IP válido.',
        },
      ];
    case 'dominio-whois':
      return [
        {
          name: 'domain',
          label: 'Domínio',
          hint: 'Ex.: exemplo.com.br, sem http:// ou www',
          normalize: (value) => value.trim().toLowerCase(),
          validate: (value) => isValidDomain(value) ? undefined : 'Informe um domínio válido, sem protocolo ou www.',
        },
      ];
  }

  return [{
    name: 'value',
    label: 'Valor da consulta',
    hint: 'Informe o valor solicitado para Chamadas/Consultas',
    inputMode: 'text',
  }];
}

const CPF_MODULES = new Set([
  'cpf-basico',
  'dossie-360',
  'cpf-cadsus',
  'cpf-intelligent',
  'cpf-obito',
  'cpf-parentes',
  'cpf-score',
  'cpf-detran',
  'sptrans-cpf',
  'cpf-rais',
  'irpf-cpf',
]);

const CNPJ_MODULES = new Set(['cnpj-basico', 'cnpj-funcionarios']);

function cpfField(): Field {
  return {
    name: 'cpf',
    label: 'CPF',
    hint: 'Digite 11 números, sem pontuação',
    inputMode: 'numeric',
    maxLength: 11,
    minLength: 11,
    normalize: (value) => value.replace(/\D/gu, '').slice(0, 11),
    pattern: '\\d{11}',
    validate: (value) => /^\d{11}$/u.test(value) ? undefined : 'Informe um CPF com 11 números.',
  };
}

function cnpjField(): Field {
  return {
    name: 'cnpj',
    label: 'CNPJ',
    hint: 'Digite 14 números, sem pontuação',
    inputMode: 'numeric',
    maxLength: 14,
    minLength: 14,
    normalize: (value) => value.replace(/\D/gu, '').slice(0, 14),
    pattern: '\\d{14}',
    validate: (value) => /^\d{14}$/u.test(value) ? undefined : 'Informe um CNPJ com 14 números.',
  };
}

function emailField(): Field {
  return {
    name: 'email',
    label: 'E-mail',
    hint: 'Digite o endereço de e-mail completo',
    type: 'email',
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) ? undefined : 'Informe um e-mail válido.',
  };
}

function phoneField(): Field {
  return {
    name: 'phone',
    label: 'Telefone',
    hint: 'Digite DDD + número, somente números',
    inputMode: 'numeric',
    maxLength: 11,
    minLength: 10,
    normalize: (value) => value.replace(/\D/gu, '').slice(0, 11),
    pattern: '\\d{10,11}',
    validate: (value) => /^\d{10,11}$/u.test(value) ? undefined : 'Informe um telefone com 10 ou 11 números.',
  };
}

function queryField(label: string, hint: string): Field {
  return { name: 'query', label, hint };
}

function plateField(): Field {
  return {
    name: 'plate',
    label: 'Placa',
    hint: 'Ex.: ABC1234 ou ABC1D23, sem espaço ou hífen',
    maxLength: 7,
    minLength: 7,
    normalize: (value) => value.replace(/[^a-z\d]/giu, '').toUpperCase().slice(0, 7),
    pattern: '[A-Z]{3}[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}[0-9]{4}',
    validate: (value) => /^(?:[A-Z]{3}\d[A-Z\d]\d{2}|[A-Z]{3}\d{4})$/u.test(value)
      ? undefined
      : 'Informe uma placa válida com 7 caracteres.',
  };
}

function chassiField(): Field {
  return {
    name: 'chassi',
    label: 'Chassi',
    hint: 'Digite o VIN com 17 caracteres, sem espaços',
    maxLength: 17,
    minLength: 17,
    normalize: (value) => value.replace(/[^a-z\d]/giu, '').toUpperCase().slice(0, 17),
    pattern: '[A-HJ-NPR-Z0-9]{17}',
    validate: (value) => /^[A-HJ-NPR-Z0-9]{17}$/u.test(value)
      ? undefined
      : 'Informe um chassi válido com 17 caracteres.',
  };
}

function renavamField(): Field {
  return {
    name: 'renavam',
    label: 'RENAVAM',
    hint: 'Digite de 9 a 11 números',
    inputMode: 'numeric',
    maxLength: 11,
    minLength: 9,
    normalize: (value) => value.replace(/\D/gu, '').slice(0, 11),
    pattern: '\\d{9,11}',
    validate: (value) => /^\d{9,11}$/u.test(value) ? undefined : 'Informe um RENAVAM com 9 a 11 números.',
  };
}

function pisField(): Field {
  return {
    name: 'pis',
    label: 'PIS/PASEP/NIT',
    hint: 'Digite 11 números, sem pontuação',
    inputMode: 'numeric',
    maxLength: 11,
    minLength: 11,
    normalize: (value) => value.replace(/\D/gu, '').slice(0, 11),
    pattern: '\\d{11}',
    validate: (value) => /^\d{11}$/u.test(value) ? undefined : 'Informe 11 números de PIS/PASEP/NIT.',
  };
}

function optionalTextField(name: string, label: string, hint: string, options: Omit<Field, 'name' | 'label' | 'hint' | 'required'> = {}): Field {
  return { name, label, hint, required: false, ...options };
}

function optionalNumberField(
  name: string,
  label: string,
  hint: string,
  validate?: Field['validate'],
  serialize?: Field['serialize'],
): Field {
  return optionalTextField(name, label, hint, {
    inputMode: 'numeric',
    normalize: (value) => value.replace(/\D/gu, ''),
    serialize,
    validate,
  });
}

function toNumber(value: string): number {
  return Number(value);
}

function positiveInteger(value: string): string | undefined {
  return /^[1-9]\d*$/u.test(value) ? undefined : 'Informe um número inteiro positivo.';
}

function boundedInteger(min: number, max: number): Field['validate'] {
  return (value) => {
    if (!/^\d+$/u.test(value)) {
      return 'Informe um número válido.';
    }

    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max
      ? undefined
      : `Informe um número entre ${min} e ${max}.`;
  };
}

function paginationFields(limitMax: number): Field[] {
  return [
    optionalNumberField('page', 'Página', 'Opcional; padrão 1', positiveInteger, toNumber),
    optionalNumberField('limit', 'Limite', `Opcional; até ${limitMax} registros`, boundedInteger(1, limitMax), toNumber),
  ];
}

function nameSearchFields(): Field[] {
  return [
    ...paginationFields(50),
    optionalTextField('sexo', 'Sexo', 'Opcional; M ou F', {
      maxLength: 1,
      normalize: (value) => value.toUpperCase().slice(0, 1),
      pattern: '[MF]',
      validate: (value) => /^[MF]$/u.test(value) ? undefined : 'Informe M ou F.',
    }),
    optionalTextField('uf', 'UF', 'Opcional; sigla com 2 letras', {
      maxLength: 2,
      normalize: (value) => value.replace(/[^a-z]/giu, '').toUpperCase().slice(0, 2),
      pattern: '[A-Z]{2}',
      validate: (value) => /^[A-Z]{2}$/u.test(value) ? undefined : 'Informe uma UF com 2 letras.',
    }),
    optionalTextField('cidade', 'Cidade', 'Opcional; filtra a cidade'),
    optionalTextField('cep', 'CEP', 'Opcional; mínimo de 5 números', {
      inputMode: 'numeric',
      maxLength: 8,
      normalize: (value) => value.replace(/\D/gu, '').slice(0, 8),
      validate: (value) => /^\d{5,8}$/u.test(value) ? undefined : 'Informe um CEP com pelo menos 5 números.',
    }),
    optionalTextField('flag_obito', 'Filtro de óbito', 'Opcional; 1 para óbito ou 0 para vivo', {
      inputMode: 'numeric',
      maxLength: 1,
      normalize: (value) => value.replace(/\D/gu, '').slice(0, 1),
      pattern: '[01]',
      validate: (value) => /^[01]$/u.test(value) ? undefined : 'Informe 1 ou 0.',
    }),
    optionalTextField('faixa_renda', 'Faixa de renda', 'Opcional; de 1 a 5', {
      inputMode: 'numeric',
      maxLength: 1,
      normalize: (value) => value.replace(/\D/gu, '').slice(0, 1),
      validate: (value) => /^[1-5]$/u.test(value) ? undefined : 'Informe uma faixa de 1 a 5.',
    }),
    optionalTextField('nascimento_exact', 'Nascimento exato', 'Opcional; AAAA-MM-DD ou DD/MM/AAAA', {
      validate: (value) => /^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/u.test(value)
        ? undefined
        : 'Informe a data como AAAA-MM-DD ou DD/MM/AAAA.',
    }),
    optionalNumberField('year_from', 'Ano inicial', 'Opcional; ano de nascimento', boundedInteger(1900, new Date().getFullYear()), toNumber),
    optionalNumberField('year_to', 'Ano final', 'Opcional; ano de nascimento', boundedInteger(1900, new Date().getFullYear()), toNumber),
  ];
}

function employeeFilterFields(): Field[] {
  return [
    optionalNumberField('page', 'Página', 'Opcional; padrão 1', positiveInteger, toNumber),
    optionalNumberField('pageSize', 'Itens por página', 'Opcional; até 200 registros', boundedInteger(1, 200), toNumber),
    optionalTextField('q', 'Nome do funcionário', 'Opcional; filtra pelo início do nome'),
    optionalNumberField('ano', 'Ano-base', 'Opcional; ano declarado', boundedInteger(1900, new Date().getFullYear()), toNumber),
  ];
}

function leakedLoginsQueryField(): Field {
  return {
    name: 'q',
    label: 'Busca',
    hint: 'URL, domínio, e-mail, CPF ou padrão com *',
    validate: (value) => (value.match(/[a-z0-9]/giu) ?? []).length >= 5
      ? undefined
      : 'Informe pelo menos 5 letras ou números.',
  };
}

function leakedLoginsFilterFields(): Field[] {
  return [
    optionalTextField('type', 'Tipo de busca', 'Opcional; url, email, cpf ou auto', {
      normalize: (value) => value.toLowerCase(),
      validate: (value) => /^(?:url|email|cpf|auto)$/u.test(value) ? undefined : 'Informe url, email, cpf ou auto.',
    }),
    optionalNumberField('page', 'Página', 'Opcional; padrão 1', positiveInteger, toNumber),
    optionalNumberField('limit', 'Limite', 'Opcional; até 50 itens', boundedInteger(1, 50), toNumber),
    optionalTextField('root_domain', 'Domínio raiz', 'Opcional; filtra por um site específico'),
    optionalTextField('scope', 'Escopo', 'Opcional; domain ou url', {
      normalize: (value) => value.toLowerCase(),
      validate: (value) => /^(?:domain|url)$/u.test(value) ? undefined : 'Informe domain ou url.',
    }),
  ];
}

function isValidIp(value: string): boolean {
  if (value.includes(':')) {
    if (value.includes('%')) {
      return false;
    }

    try {
      const parsed = new URL(`http://[${value}]/`);
      return parsed.hostname.startsWith('[') && parsed.hostname.endsWith(']');
    } catch {
      return false;
    }
  }

  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) =>
    /^(?:0|[1-9]\d{0,2})$/u.test(part) && Number(part) <= 255,
  );
}

function isValidDomain(value: string): boolean {
  return value.length <= 253
    && !value.includes('://')
    && !value.startsWith('www.')
    && /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,}$/iu.test(value);
}
