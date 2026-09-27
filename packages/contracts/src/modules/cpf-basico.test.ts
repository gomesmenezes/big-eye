import { describe, expect, it } from 'vitest';

import { cpfBasicoInput, cpfBasicoOutput } from './cpf-basico.js';

describe('contrato cpf-basico', () => {
  it('aceita CPF com onze dígitos', () => {
    expect(cpfBasicoInput.parse({ cpf: '12345678909' })).toEqual({ cpf: '12345678909' });
  });

  it.each(['1234567890', '1234567890a', '123.456.789-09'])('rejeita o CPF %s', (cpf) => {
    expect(cpfBasicoInput.safeParse({ cpf }).success).toBe(false);
  });

  it('valida o resultado esperado e permite campos opcionais ausentes', () => {
    expect(cpfBasicoOutput.parse({ nome: 'Maria Silva', cpf: '12345678909' })).toEqual({
      nome: 'Maria Silva',
      cpf: '12345678909',
    });
  });
});
