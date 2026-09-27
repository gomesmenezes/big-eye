import { describe, expect, it } from 'vitest';

import { dossie360Input, dossie360Output } from './dossie-360.js';

describe('contrato dossie-360', () => {
  it('aceita CPF com onze dígitos', () => {
    expect(dossie360Input.safeParse({ cpf: '12345678909' }).success).toBe(true);
  });

  it('exige resumo e lista de fontes no resultado', () => {
    expect(
      dossie360Output.parse({
        resumo: 'Resumo da consulta',
        fontes: ['base-cadastral', 'base-publica'],
      }),
    ).toEqual({ resumo: 'Resumo da consulta', fontes: ['base-cadastral', 'base-publica'] });

    expect(dossie360Output.safeParse({ resumo: 'Resumo', fontes: 'base-cadastral' }).success).toBe(
      false,
    );
  });
});
