'use client';

import { useEffect, useState } from 'react';

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
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

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

    try {
      const created = await apiFetch<PaymentDTOType>('/payments', {
        method: 'POST',
        body: JSON.stringify({ packageId: selectedPackageId, method }),
      });
      setPayment(created);

      if (method === 'card' && created.checkoutUrl) {
        window.location.assign(created.checkoutUrl);
        return;
      }

      if (created.status === 'pending') {
        await pollPayment(created.id);
      }
    } catch (caughtError) {
      setError(paymentErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function pollPayment(paymentId: string): Promise<void> {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await wait(2_000);
      const current = await apiFetch<PaymentDTOType>(`/payments/${paymentId}`);
      setPayment(current);

      if (current.status === 'paid') {
        await onPaymentPaid();
        return;
      }

      if (current.status === 'failed' || current.status === 'expired' || current.status === 'refunded') {
        return;
      }
    }

    setError('O pagamento ainda está pendente. Você pode deixar esta página aberta para continuar acompanhando.');
  }

  async function copyPixCode(): Promise<void> {
    if (!payment?.pixQrCode) {
      return;
    }

    await navigator.clipboard.writeText(payment.pixQrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol-600">Comprar créditos</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Escolha um pacote</h2>
        <p className="mt-1 text-sm text-slate-500">Pagamento via Pix é confirmado automaticamente quando o provedor enviar o webhook.</p>
      </div>

      {packages.length === 0 ? (
        <p className="mt-6 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Nenhum pacote está disponível no momento.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {packages.map((creditPackage) => {
              const selected = creditPackage.id === selectedPackageId;

              return (
                <button
                  aria-pressed={selected}
                  className={`rounded-xl border p-4 text-left transition ${selected ? 'border-petrol-500 bg-petrol-50 ring-2 ring-petrol-100' : 'border-slate-200 hover:border-petrol-300'}`}
                  key={creditPackage.id}
                  onClick={() => setSelectedPackageId(creditPackage.id)}
                  type="button"
                >
                  <span className="block text-lg font-semibold text-slate-950">{creditPackage.credits} créditos</span>
                  <span className="mt-1 block text-sm text-slate-500">{formatBRL(creditPackage.priceCents)}</span>
                </button>
              );
            })}
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-slate-700">Forma de pagamento</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${method === 'pix' ? 'border-petrol-500 bg-petrol-50' : 'border-slate-200'}`}>
                <input checked={method === 'pix'} name="payment-method" onChange={() => setMethod('pix')} type="radio" value="pix" />
                <span><strong className="block text-slate-900">Pix</strong><span className="text-slate-500">Confirmação automática</span></span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${method === 'card' ? 'border-petrol-500 bg-petrol-50' : 'border-slate-200'}`}>
                <input checked={method === 'card'} name="payment-method" onChange={() => setMethod('card')} type="radio" value="card" />
                <span><strong className="block text-slate-900">Cartão</strong><span className="text-slate-500">Abrir checkout seguro</span></span>
              </label>
            </div>
          </fieldset>

          <button
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-petrol-600 px-4 py-3 text-sm font-semibold text-white hover:bg-petrol-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void startPayment()}
            type="button"
          >
            {isSubmitting ? 'Aguardando confirmação...' : 'Continuar para pagamento'}
          </button>
        </>
      )}

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p> : null}
      {payment ? <PaymentStatus copied={copied} onCopy={copyPixCode} payment={payment} /> : null}
    </section>
  );
}

function PaymentStatus({ payment, copied, onCopy }: { payment: PaymentDTOType; copied: boolean; onCopy: () => Promise<void> }) {
  const labels: Record<PaymentDTOType['status'], string> = {
    pending: 'Aguardando pagamento',
    paid: 'Pagamento confirmado',
    failed: 'Pagamento não concluído',
    expired: 'Pagamento expirado',
    refunded: 'Pagamento reembolsado',
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5" role="status">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold text-slate-950">{labels[payment.status]}</p>
        <span className="text-sm text-slate-500">{payment.credits} créditos</span>
      </div>
      {payment.pixQrCode && payment.status === 'pending' ? (
        <div className="mt-4">
          <p className="text-sm text-slate-600">Copie o código Pix abaixo para concluir o pagamento:</p>
          <code className="mt-3 block break-all rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">{payment.pixQrCode}</code>
          <button className="mt-3 text-sm font-semibold text-petrol-700 hover:text-petrol-800" onClick={() => void onCopy()} type="button">
            {copied ? 'Código copiado' : 'Copiar código Pix'}
          </button>
        </div>
      ) : null}
      {payment.status === 'paid' ? <p className="mt-3 text-sm text-emerald-700">Seu saldo foi atualizado.</p> : null}
      {payment.checkoutUrl && payment.status === 'pending' ? <p className="mt-3 text-sm text-slate-600">O checkout do cartão foi aberto em uma nova etapa.</p> : null}
    </div>
  );
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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
