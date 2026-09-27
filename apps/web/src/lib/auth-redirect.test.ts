import { describe, expect, it } from 'vitest';

import { getSafeNextPath } from './auth-redirect';

describe('getSafeNextPath', () => {
  it('preserva caminho e query internos', () => {
    expect(getSafeNextPath('/consulta/cpf-basico?from=catalogo')).toBe(
      '/consulta/cpf-basico?from=catalogo',
    );
  });

  it('usa o dashboard para URLs externas ou inválidas', () => {
    expect(getSafeNextPath('https://evil.example.test')).toBe('/dashboard');
    expect(getSafeNextPath('//evil.example.test')).toBe('/dashboard');
    expect(getSafeNextPath(undefined)).toBe('/dashboard');
  });
});
