import { z } from 'zod';

const uptimePercent = z.number().min(0).max(100).nullable();

const uptimeWindowSchema = z.object({
  '24h': uptimePercent,
  '7d': uptimePercent,
  '31d': uptimePercent,
}).passthrough();

const sampledRequestsSchema = z.object({
  '24h': z.number().int().nonnegative(),
  '7d': z.number().int().nonnegative(),
  '31d': z.number().int().nonnegative(),
}).passthrough();

export const AthenasEndpointStatusDTO = z.object({
  id: z.string(),
  name: z.string(),
  group: z.string(),
  path: z.string(),
  status: z.enum(['operational', 'degraded', 'unavailable', 'idle']),
  operational: z.boolean(),
  uptime: uptimeWindowSchema,
  avgResponseMs: z.number().nonnegative().nullable(),
  sampledRequests: sampledRequestsSchema,
}).passthrough();

export const AthenasStatusDTO = z.object({
  status: z.enum(['operational', 'partial_outage', 'major_outage', 'idle']),
  operational: z.boolean(),
  description: z.string(),
  generatedAt: z.string().datetime({ offset: true }),
  cached: z.boolean(),
  uptime: uptimeWindowSchema,
  summary: z.object({
    total: z.number().int().nonnegative(),
    operational: z.number().int().nonnegative(),
    degraded: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    idle: z.number().int().nonnegative(),
  }).passthrough(),
  thresholds: z.object({
    operationalAbovePct: z.number(),
    degradedAbovePct: z.number(),
    note: z.string(),
  }).passthrough().optional(),
  endpoints: z.array(AthenasEndpointStatusDTO),
}).passthrough();

export const AthenasStatusDisabledDTO = z.object({
  status: z.literal('disabled'),
}).passthrough();

export const AthenasStatusResponseDTO = z.union([
  AthenasStatusDTO,
  AthenasStatusDisabledDTO,
]);

export type AthenasEndpointStatusDTOType = z.infer<typeof AthenasEndpointStatusDTO>;
export type AthenasStatusDTOType = z.infer<typeof AthenasStatusDTO>;
export type AthenasStatusResponseDTOType = z.infer<typeof AthenasStatusResponseDTO>;
