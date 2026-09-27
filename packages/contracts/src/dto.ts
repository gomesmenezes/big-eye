import { z } from 'zod';

import { ERROR_CODES } from './errors.js';

const isoDateTime = z.string().datetime({ offset: true });

export const CreateQueryBody = z.object({
  moduleSlug: z.string().regex(/^[a-z0-9-]+$/),
  input: z.record(z.unknown()),
});

export const QueryDTO = z.object({
  id: z.string().uuid(),
  moduleSlug: z.string(),
  mode: z.enum(['sync', 'async']),
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'refunded']),
  creditsCharged: z.number().int().min(1),
  inputMasked: z.string(),
  errorCode: z.nativeEnum(ERROR_CODES).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: isoDateTime,
  startedAt: isoDateTime.nullable().optional(),
  finishedAt: isoDateTime.nullable().optional(),
  data: z.unknown().optional(),
  resultExpired: z.boolean().optional(),
});

export const MeDTO = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['user', 'admin']),
  balance: z.number().int().min(0),
});

export const TransactionDTO = z.object({
  id: z.string().uuid(),
  type: z.enum(['signup_bonus', 'purchase', 'consume', 'refund', 'admin_adjust']),
  amount: z.number().int(),
  balanceAfter: z.number().int().min(0),
  refType: z.enum(['payment', 'query', 'admin']).nullable().optional(),
  refId: z.string().uuid().nullable().optional(),
  description: z.string(),
  createdAt: isoDateTime,
});

export const PackageDTO = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  credits: z.number().int().min(1),
  priceCents: z.number().int().min(0),
  currency: z.literal('BRL'),
});

export const PaymentDTO = z.object({
  id: z.string().uuid(),
  method: z.enum(['pix', 'card']),
  amountCents: z.number().int().positive(),
  credits: z.number().int().min(1),
  status: z.enum(['pending', 'paid', 'failed', 'expired', 'refunded']),
  pixQrCode: z.string().optional(),
  checkoutUrl: z.string().url().optional(),
  expiresAt: isoDateTime.optional(),
  paidAt: isoDateTime.nullable().optional(),
  createdAt: isoDateTime,
});

export const AdminAdjustWalletBody = z.object({
  amount: z
    .number()
    .int()
    .min(-2_147_483_648)
    .max(2_147_483_647)
    .refine((amount) => amount !== 0, 'O ajuste deve ser diferente de zero.'),
  reason: z.string().trim().min(1).max(500),
});

export type CreateQueryBodyType = z.infer<typeof CreateQueryBody>;
export type QueryDTOType = z.infer<typeof QueryDTO>;
export type MeDTOType = z.infer<typeof MeDTO>;
export type TransactionDTOType = z.infer<typeof TransactionDTO>;
export type PackageDTOType = z.infer<typeof PackageDTO>;
export type PaymentDTOType = z.infer<typeof PaymentDTO>;
export type AdminAdjustWalletBodyType = z.infer<typeof AdminAdjustWalletBody>;
