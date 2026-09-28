import { describe, expect, it } from 'vitest';

import { getModule, MODULES } from './index.js';

describe('catálogo de Chamadas/Consultas', () => {
  it('tem slugs únicos, não vazios e no formato público', () => {
    const slugs = MODULES.map((module) => module.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => /^[a-z0-9-]+$/.test(slug))).toBe(true);
  });

  it('mantém custo inteiro positivo e modo válido em todas as entradas', () => {
    for (const module of MODULES) {
      expect(Number.isInteger(module.custoCreditos)).toBe(true);
      expect(module.custoCreditos).toBeGreaterThanOrEqual(1);
      expect(['sync', 'async']).toContain(module.mode);
    }
  });

  it('tem as quatro categorias e as duas Chamadas/Consultas da fase 1 implementadas', () => {
    expect(new Set(MODULES.map((module) => module.categoria))).toEqual(
      new Set(['pessoais', 'veiculares', 'empresariais', 'web']),
    );
    expect(MODULES).toHaveLength(30);
    expect(MODULES.filter((module) => module.implemented).map((module) => module.slug)).toEqual([
      'cpf-basico',
      'dossie-360',
    ]);
  });

  it('encontra uma Chamada/Consulta pelo slug e devolve undefined para slug desconhecido', () => {
    expect(getModule('cpf-basico')?.nome).toBe('CPF Completo');
    expect(getModule('nao-existe')).toBeUndefined();
  });
});
