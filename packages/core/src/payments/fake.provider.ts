import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import {
  InvalidPaymentEventError,
  InvalidPaymentSignatureError,
  type CheckoutInput,
  type CheckoutResult,
  type NormalizedPaymentEvent,
  type PaymentProvider,
  type ProviderPaymentStatus,
} from './payment-provider.js';

const fakeWebhookSchema = z.object({
  providerEventId: z.string().trim().min(1),
  providerPaymentId: z.string().trim().min(1),
  status: z.enum(['paid', 'failed', 'expired']),
  paidAt: z.string().datetime({ offset: true }).optional(),
});

export type FakeWebhookInput = z.input<typeof fakeWebhookSchema>;

type Clock = () => Date;

export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';

  private readonly statuses = new Map<string, ProviderPaymentStatus>();

  constructor(
    private readonly secret = process.env.FAKE_PAYMENT_SECRET ?? 'fake-payment-secret',
    private readonly clock: Clock = () => new Date(),
  ) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const providerPaymentId = `fake_payment_${randomUUID()}`;
    const expiresAt = new Date(this.clock().getTime() + 30 * 60 * 1000);

    this.statuses.set(providerPaymentId, 'pending');

    if (input.method === 'pix') {
      return {
        providerPaymentId,
        method: 'pix',
        pixQrCode: `00020126580014br.gov.bcb.pix0136${providerPaymentId}`,
        expiresAt,
      };
    }

    return {
      providerPaymentId,
      method: 'card',
      checkoutUrl: `https://checkout.fake.local/pay/${providerPaymentId}`,
    };
  }

  async parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<NormalizedPaymentEvent> {
    const signature = getHeader(headers, 'x-fake-signature');

    if (!signature || !hasValidSignature(rawBody, signature, this.secret)) {
      throw new InvalidPaymentSignatureError();
    }

    let decoded: unknown;

    try {
      decoded = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new InvalidPaymentEventError('Payment webhook body must be valid JSON.');
    }

    const parsed = fakeWebhookSchema.safeParse(decoded);

    if (!parsed.success) {
      throw new InvalidPaymentEventError('Payment webhook payload is invalid.');
    }

    const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined;
    this.statuses.set(parsed.data.providerPaymentId, parsed.data.status);

    return {
      providerEventId: parsed.data.providerEventId,
      providerPaymentId: parsed.data.providerPaymentId,
      status: parsed.data.status,
      paidAt,
      raw: parsed.data,
    };
  }

  async getStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    return this.statuses.get(providerPaymentId) ?? 'pending';
  }

  setStatus(providerPaymentId: string, status: ProviderPaymentStatus): void {
    this.statuses.set(providerPaymentId, status);
  }

  createWebhook(input: FakeWebhookInput): { body: Buffer; signature: string } {
    const body = Buffer.from(JSON.stringify(input), 'utf8');
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');

    return { body, signature };
  }
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const expectedName = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === expectedName);
  return entry?.[1];
}

function hasValidSignature(rawBody: Buffer, suppliedSignature: string, secret: string): boolean {
  const normalizedSignature = suppliedSignature.replace(/^sha256=/i, '').trim().toLowerCase();
  const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex');
  const supplied = Buffer.from(normalizedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
