import { z } from 'zod';

// These schemas document the temporary phase-one shape, not real module contracts.
export const placeholderModuleInput = z
  .object({
    cpf: z.string(),
  })
  .describe('PLACEHOLDER: replace with this module input schema in phase 2');

export const placeholderModuleOutput = z
  .record(z.unknown())
  .describe('PLACEHOLDER: replace with this module output schema in phase 2');
