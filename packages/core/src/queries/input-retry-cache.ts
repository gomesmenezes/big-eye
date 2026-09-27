import { redis } from '../redis.js';

export type RetryInput = Record<string, unknown>;

export interface RetryInputCache {
  get(queryId: string): Promise<RetryInput | null>;
  set(queryId: string, input: RetryInput, ttlSeconds?: number): Promise<void>;
  del(queryId: string): Promise<void>;
}

export type RetryInputRedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<string | null>;
  del(key: string): Promise<number>;
};

export const RETRY_INPUT_CACHE_PREFIX = 'query:retry-input:';
export const RETRY_INPUT_TTL_SECONDS = 24 * 60 * 60;

function cacheKey(queryId: string): string {
  if (!queryId.trim()) {
    throw new Error('queryId é obrigatório para o cache de retry.');
  }

  return `${RETRY_INPUT_CACHE_PREFIX}${queryId}`;
}

function parseRetryInput(raw: string): RetryInput {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('Formato de input inválido.');
    }

    return parsed as RetryInput;
  } catch {
    throw new Error('Input de retry armazenado no cache está inválido.');
  }
}

export class RedisRetryInputCache implements RetryInputCache {
  constructor(
    private readonly client: RetryInputRedisClient = redis as RetryInputRedisClient,
    private readonly defaultTtlSeconds = RETRY_INPUT_TTL_SECONDS,
  ) {}

  async get(queryId: string): Promise<RetryInput | null> {
    const raw = await this.client.get(cacheKey(queryId));
    return raw === null ? null : parseRetryInput(raw);
  }

  async set(
    queryId: string,
    input: RetryInput,
    ttlSeconds = this.defaultTtlSeconds,
  ): Promise<void> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError('O TTL do input de retry deve ser positivo.');
    }

    await this.client.set(
      cacheKey(queryId),
      JSON.stringify(input),
      'EX',
      ttlSeconds,
    );
  }

  async del(queryId: string): Promise<void> {
    await this.client.del(cacheKey(queryId));
  }
}

export const retryInputCache: RetryInputCache = new RedisRetryInputCache();
