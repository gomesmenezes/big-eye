export type CheckoutInput = {
  userId: string;
  packageId: string;
  method: 'pix' | 'card';
  amountCents: number;
  credits: number;
};

export type CheckoutResult = {
  providerPaymentId: string;
  method: 'pix' | 'card';
  pixQrCode?: string;
  checkoutUrl?: string;
  expiresAt?: Date;
};

export type NormalizedPaymentEvent = {
  providerEventId: string;
  providerPaymentId: string;
  status: 'paid' | 'failed' | 'expired';
  paidAt?: Date;
  raw: unknown;
};

export type ProviderPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface PaymentProvider {
  readonly name?: string;

  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<NormalizedPaymentEvent>;

  getStatus(providerPaymentId: string): Promise<ProviderPaymentStatus>;
}

export class InvalidPaymentSignatureError extends Error {
  constructor() {
    super('Invalid payment webhook signature.');
    this.name = 'InvalidPaymentSignatureError';
  }
}

export class InvalidPaymentEventError extends Error {
  constructor(message = 'Invalid payment webhook event.') {
    super(message);
    this.name = 'InvalidPaymentEventError';
  }
}
