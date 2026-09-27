import { describe, expect, it } from 'vitest';

import { InMemoryQueryEventsBus } from '../query-events.js';
import { RedisResultCache } from '../result-cache.js';

import {
  RedisRetryInputCache,
  RETRY_INPUT_TTL_SECONDS,
} from './input-retry-cache.js';

class FakeRedis {
  private readonly values = new Map<string, string>();
  readonly ttls = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<'OK'> {
    if (mode !== 'EX' || ttlSeconds <= 0) {
      throw new Error('TTL inválido no fake Redis.');
    }

    this.values.set(key, value);
    this.ttls.set(key, ttlSeconds);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.values.delete(key) ? 1 : 0;
  }
}

describe('async query infrastructure', () => {
  it('stores and removes a result with the requested TTL', async () => {
    const redis = new FakeRedis();
    const cache = new RedisResultCache(redis, 30);

    await cache.set('query-1', { data: { resumo: 'ok' } }, 42);
    await expect(cache.get('query-1')).resolves.toEqual({
      data: { resumo: 'ok' },
    });

    await cache.del('query-1');
    await expect(cache.get('query-1')).resolves.toBeNull();
  });

  it('delivers query events to subscribers and stops after unsubscribe', async () => {
    const bus = new InMemoryQueryEventsBus();
    const received: string[] = [];
    const unsubscribe = await bus.subscribe('query-2', (event) => {
      received.push(event.status);
    });

    await bus.publish('query-2', { status: 'running' });
    await unsubscribe();
    await bus.publish('query-2', { status: 'succeeded' });

    expect(received).toEqual(['running']);
  });

  it('keeps retry input under a query key for exactly 24 hours by default', async () => {
    const redis = new FakeRedis();
    const cache = new RedisRetryInputCache(redis);

    await cache.set('query-3', { cpf: '12345678901' });
    await expect(cache.get('query-3')).resolves.toEqual({ cpf: '12345678901' });
    expect(redis.ttls.get('query:retry-input:query-3')).toBe(RETRY_INPUT_TTL_SECONDS);

    await cache.del('query-3');
    await expect(cache.get('query-3')).resolves.toBeNull();
  });
});
