import { z } from 'zod';

/**
 * Athenas returns the provider payload as an object whose fields vary by
 * upstream source. Keep that payload intact while still rejecting non-JSON
 * object responses such as arrays, strings, and null.
 */
export const athenasRawOutput = z.record(z.unknown());

export type AthenasRawOutput = z.infer<typeof athenasRawOutput>;

const cpf = z.string().regex(/^\d{11}$/u);
const cnpj = z.string().regex(/^\d{14}$/u);

const positiveInteger = z.number().int().min(1);
const page = positiveInteger.optional();
const limit = positiveInteger.max(50).optional();

/** Inputs shared by Athenas endpoints that receive a normalized CPF. */
export const athenasCpfInput = z.object({ cpf }).strict();

export const cpfCadsusInput = athenasCpfInput;
export const cpfIntelligentInput = athenasCpfInput;
export const cpfObitoInput = athenasCpfInput;
export const cpfParentesInput = athenasCpfInput;
export const cpfScoreInput = athenasCpfInput;
export const cpfDetranInput = athenasCpfInput;
export const sptransCpfInput = athenasCpfInput;
export const cpfRaisInput = athenasCpfInput;
export const irpfCpfInput = athenasCpfInput;

export const emailReversoInput = z
  .object({
    email: z.string().trim().email(),
  })
  .strict();

export const telefoneReversoInput = z
  .object({
    phone: z.string().regex(/^(?:\d{10}|\d{11})$/u),
  })
  .strict();

const nameSearchFields = {
  query: z.string().trim().min(1),
  page,
  limit,
  sexo: z.enum(['M', 'F']).optional(),
  uf: z.string().regex(/^[A-Z]{2}$/u).optional(),
  cidade: z.string().trim().min(1).optional(),
  cep: z.string().regex(/^\d{5,}$/u).optional(),
  flag_obito: z.enum(['0', '1']).optional(),
  faixa_renda: z.enum(['1', '2', '3', '4', '5']).optional(),
  nascimento_exact: z
    .string()
    .regex(/^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/u)
    .optional(),
  year_from: z.number().int().min(1900).max(2100).optional(),
  year_to: z.number().int().min(1900).max(2100).optional(),
} as const;

export const nomeAbreviadoInput = z.object(nameSearchFields).strict();
export const nomeCompletoInput = z.object(nameSearchFields).strict();

export const enderecoConsultaInput = z
  .object({
    query: z.string().trim().min(1),
    page,
    limit,
  })
  .strict();

export const placaBasicoInput = z
  .object({
    plate: z.string().regex(/^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/u),
  })
  .strict();

export const chassiConsultaInput = z
  .object({
    // VINs do not contain I, O, or Q and are exactly 17 characters long.
    chassi: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/u),
  })
  .strict();

export const renavamConsultaInput = z
  .object({
    renavam: z.string().regex(/^\d{9,11}$/u),
  })
  .strict();

export const cnpjBasicoInput = z
  .object({
    cnpj,
  })
  .strict();

export const cnpjFuncionariosInput = z
  .object({
    cnpj,
    page,
    pageSize: positiveInteger.max(200).optional(),
    q: z.string().trim().min(1).optional(),
    ano: z.string().regex(/^\d{4}$/u).optional(),
  })
  .strict();

export const ipGeolocalizacaoInput = z
  .object({
    ip: z.string().ip(),
  })
  .strict();

export const dominioWhoisInput = z
  .object({
    domain: z
      .string()
      .trim()
      .max(253)
      .regex(/^(?!www\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu),
  })
  .strict();

export const loginsVazadosInput = z
  .object({
    q: z
      .string()
      .trim()
      .min(5)
      .refine((value) => (value.match(/[a-z0-9]/giu) ?? []).length >= 5),
    type: z.enum(['url', 'email', 'cpf', 'auto']).optional(),
    page,
    limit,
    root_domain: z.string().trim().min(1).optional(),
    scope: z.enum(['domain', 'url']).optional(),
  })
  .strict();

export const pisPasepInput = z
  .object({
    pis: z.string().regex(/^\d{11}$/u),
  })
  .strict();

export type AthenasCpfInput = z.infer<typeof athenasCpfInput>;
export type CpfCadsusInput = z.infer<typeof cpfCadsusInput>;
export type CpfIntelligentInput = z.infer<typeof cpfIntelligentInput>;
export type CpfObitoInput = z.infer<typeof cpfObitoInput>;
export type CpfParentesInput = z.infer<typeof cpfParentesInput>;
export type CpfScoreInput = z.infer<typeof cpfScoreInput>;
export type CpfDetranInput = z.infer<typeof cpfDetranInput>;
export type SptransCpfInput = z.infer<typeof sptransCpfInput>;
export type CpfRaisInput = z.infer<typeof cpfRaisInput>;
export type IrpfCpfInput = z.infer<typeof irpfCpfInput>;
export type EmailReversoInput = z.infer<typeof emailReversoInput>;
export type TelefoneReversoInput = z.infer<typeof telefoneReversoInput>;
export type NomeAbreviadoInput = z.infer<typeof nomeAbreviadoInput>;
export type NomeCompletoInput = z.infer<typeof nomeCompletoInput>;
export type EnderecoConsultaInput = z.infer<typeof enderecoConsultaInput>;
export type PlacaBasicoInput = z.infer<typeof placaBasicoInput>;
export type ChassiConsultaInput = z.infer<typeof chassiConsultaInput>;
export type RenavamConsultaInput = z.infer<typeof renavamConsultaInput>;
export type CnpjBasicoInput = z.infer<typeof cnpjBasicoInput>;
export type CnpjFuncionariosInput = z.infer<typeof cnpjFuncionariosInput>;
export type IpGeolocalizacaoInput = z.infer<typeof ipGeolocalizacaoInput>;
export type DominioWhoisInput = z.infer<typeof dominioWhoisInput>;
export type LoginsVazadosInput = z.infer<typeof loginsVazadosInput>;
export type PisPasepInput = z.infer<typeof pisPasepInput>;
