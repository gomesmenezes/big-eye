'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Coins,
  QrCode,
  CreditCard,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

import type { PackageDTOType, PaymentDTOType } from '@big-eye/contracts';

import { apiFetch, ApiError } from '../lib/api';

type BuyCreditsProps = {
  packages: PackageDTOType[];
  onPaymentPaid: () => Promise<void>;
};

type PaymentMethod = 'pix' | 'card';

export function BuyCredits({ packages, onPaymentPaid }: BuyCreditsProps) {
  const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id ?? '');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [payment, setPayment] = useState<PaymentDTOType>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const paymentAbort = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => {
    paymentAbort.current?.abort();
  }, []);

  useEffect(() => {
    if (!selectedPackageId && packages[0]) {
      setSelectedPackageId(packages[0].id);
    }
  }, [packages, selectedPackageId]);

  async function startPayment(): Promise<void> {
    if (!selectedPackageId) {
      setError('Escolha um pacote para continuar.');
      return;
    }

    setError(undefined);
    setPayment(undefined);
    setIsSubmitting(true);
    paymentAbort.current?.abort();
    const controller = new AbortController();
    paymentAbort.current = controller;

    try {
      const created = await apiFetch<PaymentDTOType>('/payments', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ packageId: selectedPackageId, method }),
      });
      if (controller.signal.aborted) {
        return;
      }
      setPayment(created);

      if (method === 'card') {
        if (!created.checkoutUrl) {
          throw new Error('O checkout do cartão não está disponível no momento.');
        }
        window.location.assign(created.checkoutUrl);
        return;
      }

      if (created.status === 'pending') {
        await pollPayment(created.id, controller.signal);
      }
    } catch (caughtError) {
      if (!controller.signal.aborted) {
        setError(paymentErrorMessage(caughtError));
      }
    } finally {
      if (paymentAbort.current === controller) {
        paymentAbort.current = undefined;
        setIsPolling(false);
        setIsSubmitting(false);
      }
    }
  }

  async function resumePayment(): Promise<void> {
    if (!payment || payment.status !== 'pending' || isPolling) {
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    const controller = new AbortController();
    paymentAbort.current?.abort();
    paymentAbort.current = controller;

    try {
      await pollPayment(payment.id, controller.signal);
    } catch (caughtError) {
      if (!controller.signal.aborted) {
        setError(paymentErrorMessage(caughtError));
      }
    } finally {
      if (paymentAbort.current === controller) {
        paymentAbort.current = undefined;
        setIsPolling(false);
        setIsSubmitting(false);
      }
    }
  }

  async function pollPayment(paymentId: string, signal: AbortSignal): Promise<void> {
    setIsPolling(true);

    for (let attempt = 0; attempt < 45; attempt += 1) {
      await wait(2_000, signal);
      if (signal.aborted) {
        return;
      }

      const current = await apiFetch<PaymentDTOType>(`/payments/${paymentId}`, { signal });
      setPayment(current);

      if (current.status === 'paid') {
        await onPaymentPaid();
        return;
      }

      if (current.status === 'failed' || current.status === 'expired' || current.status === 'refunded') {
        return;
      }
    }

    setError('O acompanhamento foi pausado após 90 segundos. Retome quando quiser para consultar o status novamente.');
  }

  async function copyPixCode(): Promise<void> {
    if (!payment?.pixQrCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payment.pixQrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError('Não foi possível copiar o código Pix. Selecione e copie o código manualmente.');
    }
  }

  return (
    <section className="rounded-2xl border border-[#1e202f] bg-[#12131d] p-6 shadow-card sm:p-8">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-violet-500" />
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-violet-400">
          Planos & Créditos
        </h2>
      </div>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-white">
        Escolha um pacote
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Pagamento via Pix é confirmado automaticamente com ativação imediata dos créditos.
      </p>

      {packages.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#1e202f] bg-[#181926] p-6 text-center text-xs text-slate-400">
          Nenhum pacote está disponível no momento.
        </div>
      ) : (
        <>
          {/* Packages Selector */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {packages.map((creditPackage, index) => {
              const selected = creditPackage.id === selectedPackageId;
              const isPopular = packages.length >= 3 && index === 1;

              return (
                <button
                  aria-pressed={selected}
                  className={`relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all ${
                    selected
                      ? 'border-violet-500 bg-violet-950/40 ring-1 ring-violet-500/50 shadow-glow-sm'
                      : 'border-[#1e202f] bg-[#181926] hover:border-[#32364e] hover:bg-[#1a1c2b]'
                  }`}
                  key={creditPackage.id}
                  onClick={() => setSelectedPackageId(creditPackage.id)}
                  type="button"
                >
                  {isPopular ? (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-glow-sm">
                      Mais Popular
                    </span>
                  ) : null}

                  <div>
                    <span className="block text-2xl font-black tracking-tight text-white">
                      {creditPackage.credits} créditos
                    </span>
                  </div>

                  <div className="mt-4 border-t border-[#26293d] pt-3">
                    <span className="block text-sm font-bold text-violet-300">
                      {formatBRL(creditPackage.priceCents)}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {(creditPackage.priceCents / creditPackage.credits / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}{' '}
                      / consulta
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Payment Method Selector */}
          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Forma de pagamento
            </legend>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-3.5 rounded-xl border p-4 transition ${
                  method === 'pix'
                    ? 'border-violet-500 bg-violet-950/40 ring-1 ring-violet-500/50 text-white'
                    : 'border-[#1e202f] bg-[#181926] text-slate-300 hover:bg-[#1e202f]'
                }`}
              >
                <input
                  checked={method === 'pix'}
                  className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                  name="payment-method"
                  onChange={() => setMethod('pix')}
                  type="radio"
                  value="pix"
                />
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-950/80 text-teal-400 border border-teal-800/50">
                    <QrCode className="h-4 w-4" />
                  </div>
                  <div>
                    <strong className="block text-sm font-bold text-white">Pix</strong>
                    <span className="text-xs text-slate-400">Liberação instantânea automática</span>
                  </div>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3.5 rounded-xl border p-4 transition ${
                  method === 'card'
                    ? 'border-violet-500 bg-violet-950/40 ring-1 ring-violet-500/50 text-white'
                    : 'border-[#1e202f] bg-[#181926] text-slate-300 hover:bg-[#1e202f]'
                }`}
              >
                <input
                  checked={method === 'card'}
                  className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                  name="payment-method"
                  onChange={() => setMethod('card')}
                  type="radio"
                  value="card"
                />
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25283b] text-slate-300 border border-[#32364e]">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <strong className="block text-sm font-bold text-white">Cartão</strong>
                    <span className="text-xs text-slate-400">Abrir checkout seguro</span>
                  </div>
                </div>
              </label>
            </div>
          </fieldset>

          {/* Action Submit Button */}
          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-glow-sm transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || isPolling}
            onClick={() => void startPayment()}
            type="button"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aguardando confirmação...</span>
              </>
            ) : (
              <>
                <span>Continuar para pagamento</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </>
      )}

      {error ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/30 p-3.5 text-xs text-red-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : null}

      {payment ? (
        <PaymentStatus
          copied={copied}
          isPolling={isPolling}
          onCopy={copyPixCode}
          onResume={resumePayment}
          payment={payment}
        />
      ) : null}
    </section>
  );
}

function PaymentStatus({
  payment,
  copied,
  isPolling,
  onCopy,
  onResume,
}: {
  payment: PaymentDTOType;
  copied: boolean;
  isPolling: boolean;
  onCopy: () => Promise<void>;
  onResume: () => Promise<void>;
}) {
  const labels: Record<PaymentDTOType['status'], string> = {
    pending: 'Aguardando pagamento',
    paid: 'Pagamento confirmado',
    failed: 'Pagamento não concluído',
    expired: 'Pagamento expirado',
    refunded: 'Pagamento reembolsado',
  };

  const isPending = payment.status === 'pending';
  const isPaid = payment.status === 'paid';

  return (
    <div
      className={`mt-6 rounded-2xl border p-5 transition-all ${
        isPaid
          ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200'
          : isPending
          ? 'border-violet-800/60 bg-[#161827] text-slate-200'
          : 'border-red-800/60 bg-red-950/30 text-red-200'
      }`}
      role="status"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {isPaid ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          ) : isPending ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Clock className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white">
              <AlertCircle className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="font-bold text-sm text-white">{labels[payment.status]}</p>
            <p className="text-xs text-slate-400">Pacote selecionado: {payment.credits} créditos</p>
          </div>
        </div>
        <span className="rounded-full border border-[#2a2d40] bg-[#181926] px-2.5 py-1 text-xs font-bold text-violet-300">
          {payment.credits} créditos
        </span>
      </div>

      {payment.pixQrCode && isPending ? (
        <div className="mt-5 rounded-xl border border-[#23263a] bg-[#0d0f17] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Chave Pix Copia e Cola
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Aguardando pagamento
            </span>
          </div>

          <code className="mt-2.5 block max-h-24 overflow-y-auto break-all rounded-lg bg-[#12131d] p-3 font-mono text-xs leading-relaxed text-slate-300 border border-[#1e202f]">
            {payment.pixQrCode}
          </code>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-glow-sm transition hover:bg-violet-500"
              onClick={() => void onCopy()}
              type="button"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Código copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar código Pix</span>
                </>
              )}
            </button>

            {!isPolling ? (
              <button
                className="rounded-lg border border-[#2a2d40] bg-[#181926] px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
                onClick={() => void onResume()}
                type="button"
              >
                Continuar acompanhando
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                Sincronizando com o banco...
              </span>
            )}
          </div>
        </div>
      ) : null}

      {isPaid ? (
        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Seu saldo foi atualizado.</span>
        </div>
      ) : null}

      {payment.checkoutUrl && isPending ? (
        <p className="mt-3 text-xs text-slate-400">
          O checkout do cartão foi aberto em uma nova etapa.
        </p>
      ) : null}
    </div>
  );
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('O acompanhamento foi cancelado.', 'AbortError'));
      return;
    }

    const timerState: { id?: number } = {};
    const onAbort = (): void => {
      if (timerState.id !== undefined) {
        window.clearTimeout(timerState.id);
      }
      reject(new DOMException('O acompanhamento foi cancelado.', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    timerState.id = timer;
  });
}

function paymentErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null) {
    const code = (error.body as { code?: unknown }).code;
    if (code === 'PAYMENT_NOT_FOUND') {
      return 'Pagamento não encontrado.';
    }
  }

  return error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.';
}
