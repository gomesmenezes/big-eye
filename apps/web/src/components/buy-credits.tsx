'use client';

import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import type { PackageDTOType, PaymentDTOType } from '@big-eye/contracts';

import { apiFetch, ApiError } from '../lib/api';

import { OrbLoader } from './orb-loader';

type BuyCreditsProps = {
  packages: PackageDTOType[];
  onPaymentPaid: () => Promise<void>;
};

type PaymentMethod = 'pix' | 'card';

const offerDetails: Record<
  string,
  {
    name: string;
    description: string;
    badge?: string;
    popular?: boolean;
    features: string[];
  }
> = {
  'teste-5': {
    name: 'Iniciante',
    description: 'Ideal para testes rápidos ou consultas avulsas pontuais.',
    badge: 'Degustação',
    features: ['5 consultas completas', 'Sem mensalidade fixa', 'Créditos vitalícios'],
  },
  'popular-1000': {
    name: 'Profissional',
    description: 'Nosso pacote mais escolhido para rotinas de investigação.',
    badge: 'Mais Popular',
    popular: true,
    features: ['1.000 consultas completas', 'Acesso total à API', 'Créditos vitalícios'],
  },
  'avancado-5000': {
    name: 'Avançado',
    description: 'Maior volume e economia expressiva por consulta.',
    badge: 'Alta Demanda',
    features: ['5.000 consultas completas', 'Tarifa reduzida por consulta', 'Créditos vitalícios'],
  },
  'pro-20000': {
    name: 'Enterprise / Pro',
    description: 'Nossa melhor tarifa unitária para grande escala.',
    badge: 'Melhor Valor',
    features: ['20.000 consultas completas', 'Menor custo por consulta', 'Créditos vitalícios'],
  },
};

const unitPriceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

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

  const selectedPackage = packages.find((p) => p.id === selectedPackageId) ?? packages[0];

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

    setError('O acompanhamento automático pausou após 90 segundos. Clique em "Continuar acompanhando" para consultar o status novamente.');
  }

  async function copyPixCode(): Promise<void> {
    if (!payment?.pixQrCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payment.pixQrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_500);
    } catch {
      setError('Não foi possível copiar o código Pix automaticamente. Selecione e copie o texto manualmente.');
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-[#1c2436] bg-[#0c101a] p-5 shadow-card sm:p-7">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Planos & Pacotes de Créditos
            </h2>
          </div>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Escolha o pacote ideal
          </h3>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-cyan-800/40 bg-cyan-950/40 px-3 py-1 text-[11px] font-semibold text-cyan-300">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span>Créditos vitalícios sem mensalidade</span>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Cada consulta consome créditos da sua carteira. Os créditos adquiridos nunca expiram e ficam disponíveis para uso imediato via painel ou API.
      </p>

      {packages.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#1c2436] bg-[#121824] p-8 text-center text-xs text-slate-400">
          Nenhum pacote está disponível para aquisição no momento.
        </div>
      ) : (
        <>
          {/* Packages Grid: 1 col on mobile, 2 cols on sm/tablet, 4 cols (single line) on lg+ */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((creditPackage, index) => {
              const selected = creditPackage.id === selectedPackageId;
              const presentation = offerDetails[creditPackage.slug] ?? {
                name: 'Pacote de Créditos',
                description: 'Use o saldo nas consultas disponíveis na plataforma.',
                features: ['Consultas completas', 'Créditos não expiram'],
              };
              const isPopular = presentation.popular ?? (packages.length >= 3 && index === 1);
              const unitPrice = unitPriceFormatter.format(
                creditPackage.priceCents / creditPackage.credits / 100,
              );

              return (
                <div
                  aria-checked={selected}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
                    selected
                      ? 'border-cyan-400/80 bg-gradient-to-b from-cyan-950/50 via-[#101726] to-[#0c101a] ring-1 ring-cyan-400/50 shadow-glow'
                      : 'border-[#1c2436] bg-[#10141f] hover:border-[#2a3752] hover:bg-[#141a27]'
                  }`}
                  key={creditPackage.id}
                  onClick={() => setSelectedPackageId(creditPackage.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSelectedPackageId(creditPackage.id);
                    }
                  }}
                  role="radio"
                  tabIndex={0}
                >
                  {/* Top Badge */}
                  {presentation.badge ? (
                    <div className="absolute -top-2.5 right-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm ${
                          isPopular
                            ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-glow'
                            : 'border border-cyan-800/60 bg-[#121a29] text-cyan-300'
                        }`}
                      >
                        {isPopular ? <Sparkles className="h-3 w-3" /> : null}
                        {presentation.badge}
                      </span>
                    </div>
                  ) : null}

                  {/* Header / Title */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        {presentation.name}
                      </span>
                      {/* Selection Radio Indicator */}
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                          selected
                            ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                            : 'border-slate-600 bg-transparent group-hover:border-slate-400'
                        }`}
                      >
                        {selected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-baseline gap-1.5">
                      <span className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                        {creditPackage.credits.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-xs font-medium text-slate-400">consultas</span>
                    </div>

                    <p className="mt-1.5 min-h-[44px] text-xs leading-relaxed text-slate-400">
                      {presentation.description}
                    </p>

                    {/* Features checklist */}
                    <ul className="mt-3 space-y-1.5 border-t border-[#1c2436]/60 pt-3">
                      {presentation.features.map((feature) => (
                        <li className="flex items-center gap-2 text-[11px] text-slate-300" key={feature}>
                          <Check className="h-3 w-3 shrink-0 text-cyan-400" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pricing footer */}
                  <div className="mt-4 border-t border-[#1c2436] pt-3.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black tracking-tight text-white sm:text-xl">
                        {formatBRL(creditPackage.priceCents)}
                      </span>
                      <span className="rounded-md border border-cyan-900/40 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                        {unitPrice} / busca
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout & Payment Method Area */}
          <div className="mt-8 border-t border-[#1c2436] pt-6">
            <div className="mx-auto max-w-2xl">
              <fieldset>
                <div className="flex items-center justify-between mb-3">
                  <legend className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Forma de pagamento
                  </legend>
                  <span className="text-xs text-slate-400">
                    Total a pagar:{' '}
                    <strong className="font-bold text-cyan-300">
                      {selectedPackage ? formatBRL(selectedPackage.priceCents) : ''}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                      method === 'pix'
                        ? 'border-cyan-400/80 bg-gradient-to-r from-cyan-950/40 to-teal-950/20 text-white ring-1 ring-cyan-400/40 shadow-glow-sm'
                        : 'border-[#1c2436] bg-[#10141f] text-slate-300 hover:border-[#2a3752] hover:bg-[#141a27]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          method === 'pix'
                            ? 'border-teal-500/50 bg-teal-950/80 text-teal-300'
                            : 'border-[#1c2436] bg-[#161d2d] text-slate-400'
                        }`}
                      >
                        <QrCode className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-white">Pix</strong>
                          <span className="rounded-full bg-emerald-950/80 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-800/50">
                            Instantâneo
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">Saldo liberado em segundos</span>
                      </div>
                    </div>
                    <input
                      checked={method === 'pix'}
                      className="h-4 w-4 text-cyan-500 focus:ring-cyan-500/50 accent-cyan-400"
                      name="payment-method"
                      onChange={() => setMethod('pix')}
                      type="radio"
                      value="pix"
                    />
                  </label>

                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                      method === 'card'
                        ? 'border-cyan-400/80 bg-gradient-to-r from-cyan-950/40 to-teal-950/20 text-white ring-1 ring-cyan-400/40 shadow-glow-sm'
                        : 'border-[#1c2436] bg-[#10141f] text-slate-300 hover:border-[#2a3752] hover:bg-[#141a27]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          method === 'card'
                            ? 'border-cyan-500/50 bg-cyan-950/80 text-cyan-300'
                            : 'border-[#1c2436] bg-[#161d2d] text-slate-400'
                        }`}
                      >
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-white">Cartão de Crédito</strong>
                        </div>
                        <span className="text-xs text-slate-400">Checkout seguro online</span>
                      </div>
                    </div>
                    <input
                      checked={method === 'card'}
                      className="h-4 w-4 text-cyan-500 focus:ring-cyan-500/50 accent-cyan-400"
                      name="payment-method"
                      onChange={() => setMethod('card')}
                      type="radio"
                      value="card"
                    />
                  </label>
                </div>
              </fieldset>

              {/* Action Submit CTA Button */}
              <button
                className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-4 text-sm font-black text-slate-950 shadow-glow transition hover:from-cyan-400 hover:to-teal-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || isPolling}
                onClick={() => void startPayment()}
                type="button"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <OrbLoader color="#020617" size={20} state="working" />
                    <span>Processando pagamento...</span>
                  </span>
                ) : (
                  <>
                    <span>
                      Pagar {selectedPackage ? formatBRL(selectedPackage.priceCents) : ''} via{' '}
                      {method === 'pix' ? 'Pix' : 'Cartão'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Security & Guarantees bar */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400 sm:justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                  Ambiente criptografado e seguro
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-teal-400" />
                  Liberação automática sem espera
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Créditos sem validade
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {error ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300" role="alert">
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
  const isPending = payment.status === 'pending';
  const isPaid = payment.status === 'paid';

  return (
    <div
      className={`mt-6 rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${
        isPaid
          ? 'border-emerald-500/60 bg-gradient-to-b from-emerald-950/40 via-[#0e1917] to-[#0a1210] text-emerald-200 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]'
          : isPending
          ? 'border-cyan-500/50 bg-gradient-to-b from-cyan-950/30 via-[#0e1524] to-[#0a0f1a] text-slate-200 shadow-glow'
          : 'border-red-800/60 bg-red-950/30 text-red-200'
      }`}
      role="status"
    >
      {/* Top Banner Status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {isPaid ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-glow">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          ) : isPending ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 shadow-glow">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
          )}
          <div>
            <h4 className="text-base font-bold text-white">
              {isPaid
                ? 'Pagamento Confirmado!'
                : isPending
                ? 'Aguardando Pagamento Pix'
                : 'Pagamento não concluído'}
            </h4>
            <p className="text-xs text-slate-400">
              {isPaid
                ? 'Os créditos foram depositados na sua carteira com sucesso.'
                : isPending
                ? 'Pague com seu banco para liberar os créditos instantaneamente.'
                : 'Houve um problema com a cobrança. Você pode tentar novamente.'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-cyan-800/60 bg-cyan-950/60 px-3 py-1 text-xs font-bold text-cyan-300 sm:self-auto">
          <span>{payment.credits.toLocaleString('pt-BR')} créditos</span>
        </div>
      </div>

      {/* Pix Payment Instructions and Visual QR Code */}
      {payment.pixQrCode && isPending ? (
        <div className="mt-6 rounded-xl border border-[#1c2436] bg-[#080b11] p-5">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            {/* QR Code local — sem vazar pixQrCode para terceiro */}
            {payment.pixQrCode ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[#1c2436] bg-white p-3 shadow-inner shrink-0 self-center md:self-auto">
                <QRCodeSVG
                  value={payment.pixQrCode}
                  size={176}
                  level="M"
                  aria-label="QR Code Pix para Pagamento"
                />
                <span className="mt-1 text-[10px] font-semibold text-slate-700">
                  Aponte a câmera do seu banco
                </span>
              </div>
            ) : null}

            {/* Pix Copy Code Block & Steps */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Pix Copia e Cola
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                  Aguardando confirmação
                </span>
              </div>

              <div className="mt-2 relative">
                <code className="block max-h-24 overflow-y-auto break-all rounded-lg border border-[#1c2436] bg-[#0d121c] p-3 text-xs leading-relaxed text-slate-300 select-all [scrollbar-width:thin]">
                  {payment.pixQrCode}
                </code>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-glow transition hover:from-cyan-400 hover:to-teal-400 active:scale-95"
                  onClick={() => void onCopy()}
                  type="button"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-slate-950 stroke-[3]" />
                      <span>Código Pix copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar Chave Pix</span>
                    </>
                  )}
                </button>

                {!isPolling ? (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#1c2436] bg-[#121824] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-[#2a3752] hover:bg-[#1a2233] hover:text-white"
                    onClick={() => void onResume()}
                    type="button"
                  >
                    <Clock className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Verificar status agora</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-900/40 bg-cyan-950/30 px-3.5 py-2 text-xs font-medium text-cyan-300">
                    <OrbLoader color="#22d3ee" size={20} state="connecting" />
                    Sincronizando com o banco...
                  </span>
                )}
              </div>

              {/* Quick instructions */}
              <div className="mt-4 rounded-lg bg-[#0e1422] p-3 text-[11px] text-slate-400 border border-[#1c2436]/60">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Abra o aplicativo do seu banco ou carteira digital;</li>
                  <li>Escolha <strong className="text-slate-200">Pix &gt; Copia e Cola</strong> ou aponte a câmera para o QR Code;</li>
                  <li>Assim que o pagamento for concluído, seu saldo será atualizado automaticamente.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Success Paid Message */}
      {isPaid ? (
        <div className="mt-5 rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>Saldo liberado e disponível para uso imediato!</span>
          </div>
          <p className="mt-1 text-xs text-emerald-400/80">
            Você já pode executar consultas avançadas e pesquisas de dados no catálogo do Big Eye.
          </p>
        </div>
      ) : null}

      {/* Card Checkout Link */}
      {payment.checkoutUrl && isPending ? (
        <div className="mt-4 rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-4">
          <p className="text-xs text-slate-300">
            O checkout seguro do cartão foi aberto. Se a janela não abriu, acesse pelo botão abaixo:
          </p>
          <a
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-cyan-500"
            href={payment.checkoutUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>Ir para checkout do cartão</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
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
