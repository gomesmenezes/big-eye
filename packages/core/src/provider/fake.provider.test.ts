import { describe, expect, it } from 'vitest';

import { FakeProvider } from './fake.provider.js';

const asyncRequest = {
  module: 'dossie-360',
  input: { cpf: '12345678900' },
};

describe('FakeProvider idempotency', () => {
  it('reuses the accepted request across retries with the same key', async () => {
    const provider = new FakeProvider();
    const first = await provider.execute({
      ...asyncRequest,
      idempotencyKey: 'query-1',
    });
    const retry = await provider.execute({
      ...asyncRequest,
      idempotencyKey: 'query-1',
    });

    expect(first).toEqual({ kind: 'accepted', requestId: expect.any(String) });
    expect(retry).toEqual(first);

    if (first.kind !== 'accepted') {
      throw new Error('O FakeProvider deveria aceitar a consulta assíncrona.');
    }

    const result = await provider.poll(first.requestId);
    expect(result).toEqual({
      kind: 'result',
      data: {
        resumo: 'Consulta simulada para o CPF final 00.',
        fontes: ['fake-provider'],
      },
    });
  });

  it('keeps requests from different queries independent for the same input', async () => {
    const provider = new FakeProvider();
    const first = await provider.execute({
      ...asyncRequest,
      idempotencyKey: 'query-1',
    });
    const second = await provider.execute({
      ...asyncRequest,
      idempotencyKey: 'query-2',
    });

    expect(first).toMatchObject({ kind: 'accepted' });
    expect(second).toMatchObject({ kind: 'accepted' });

    if (first.kind !== 'accepted' || second.kind !== 'accepted') {
      throw new Error('O FakeProvider deveria aceitar as consultas assíncronas.');
    }

    expect(second.requestId).not.toBe(first.requestId);
    await expect(provider.poll(first.requestId)).resolves.toMatchObject({ kind: 'result' });
    await expect(provider.poll(second.requestId)).resolves.toMatchObject({ kind: 'result' });
  });

  it('reuses a completed synchronous result for the same key', async () => {
    const provider = new FakeProvider();
    const first = await provider.execute({
      module: 'cpf-basico',
      input: { cpf: '12345678901' },
      idempotencyKey: 'query-sync-1',
    });
    const retry = await provider.execute({
      module: 'cpf-basico',
      input: { cpf: '98765432109' },
      idempotencyKey: 'query-sync-1',
    });

    expect(retry).toEqual(first);
  });
});
