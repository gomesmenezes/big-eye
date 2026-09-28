import { z } from 'zod';

export const cpfBasicoInput = z.object({
  cpf: z.string().regex(/^\d{11}$/),
});

export const cpfBasicoOutput = z.object({
  nome: z.string().min(1),
  cpf: z.string().regex(/^\d{11}$/),
  nascimento: z.string().optional(),
  situacao: z.string().optional(),
}).passthrough();

export type CpfBasicoInput = z.infer<typeof cpfBasicoInput>;
export type CpfBasicoOutput = z.infer<typeof cpfBasicoOutput>;
