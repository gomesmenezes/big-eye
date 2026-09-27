import type { PackageDTOType, TransactionDTOType } from '@big-eye/contracts';

export type AdminUser = {
  id: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'suspended';
  balance?: number;
  createdAt?: string;
};

export type AdminUserDetail = AdminUser & {
  transactions?: TransactionDTOType[];
  wallet?: { balance?: number };
};

export type AdminQuery = {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  moduleSlug: string;
  mode?: 'sync' | 'async';
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'refunded';
  creditsCharged?: number;
  inputMasked?: string;
  idempotencyKey?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type AdminQueryEvent = {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  source: string;
  message: string;
  createdAt: string;
};

export type AdminQueryDetail = AdminQuery & {
  events?: AdminQueryEvent[];
};

export type AdminPayment = {
  id: string;
  userId?: string;
  userEmail?: string;
  provider?: string;
  providerPaymentId?: string | null;
  method: 'pix' | 'card';
  amountCents: number;
  credits: number;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  createdAt: string;
  paidAt?: string | null;
  expiresAt?: string;
};

export type AdminPackage = PackageDTOType & {
  active?: boolean;
  sort?: number;
};

export type AdminDashboard = {
  newUsers?: number;
  creditsSold?: number;
  creditsConsumed?: number;
  failureRate?: number;
  queriesByModule?: Array<{ moduleSlug: string; count: number }>;
  totals?: {
    newUsers?: number;
    creditsSold?: number;
    creditsConsumed?: number;
    failureRate?: number;
  };
};

export type ListEnvelope<T> = {
  items?: T[];
  data?: T[];
  users?: T[];
  queries?: T[];
  payments?: T[];
  packages?: T[];
  nextCursor?: string | null;
  cursor?: string | null;
};

export function readItems<T>(value: unknown, keys: Array<keyof ListEnvelope<T>> = ['items', 'data']): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of keys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }

  return [];
}

export function readNextCursor(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const cursor = value.nextCursor ?? value.cursor;
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getText(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function getBalance(user: AdminUserDetail): number {
  return getNumber(user.balance ?? user.wallet?.balance);
}

export function formatDate(value: string | undefined | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function formatFailureRate(value: number | undefined): string {
  const rate = getNumber(value);
  return `${(rate <= 1 ? rate * 100 : rate).toFixed(1)}%`;
}

export function statusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    active: 'Ativo',
    suspended: 'Suspenso',
    pending: 'Pendente',
    running: 'Processando',
    succeeded: 'Concluída',
    failed: 'Falhou',
    refunded: 'Reembolsada',
    paid: 'Pago',
    expired: 'Expirado',
  };

  return status ? labels[status] ?? status : '—';
}

export function statusClass(status: string | undefined): string {
  const classes: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    suspended: 'bg-red-50 text-red-700',
    pending: 'bg-amber-50 text-amber-700',
    running: 'bg-amber-50 text-amber-800',
    succeeded: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
    refunded: 'bg-amber-50 text-amber-800',
    paid: 'bg-emerald-50 text-emerald-700',
    expired: 'bg-slate-100 text-slate-600',
  };

  return classes[status ?? ''] ?? 'bg-slate-100 text-slate-600';
}
