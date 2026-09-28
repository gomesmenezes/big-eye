import { z } from 'zod';

export const dossie360Input = z.object({
  cpf: z.string().regex(/^\d{11}$/),
});

export const dossie360Output = z.object({
  resumo: z.string(),
  fontes: z.array(z.string()),
}).passthrough();

export type Dossie360Input = z.infer<typeof dossie360Input>;
export type Dossie360Output = z.infer<typeof dossie360Output>;
