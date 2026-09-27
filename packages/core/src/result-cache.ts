import { redis } from './redis.js';

export type ResultCachePayload = {
  data: unknown;
};

export interface ResultCache {
  get(queryId: string): Promise<ResultCachePayload | null>;
  set(queryId: string, payload: ResultCachePayload, ttlSeconds?: number): Promise<void>;
  del(queryId: string): Promise<void>;
}

export type ResultCacheRedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<string | null>;
  del(key: string): Promise<number>;
};

const RESULT_CACHE_PREFIX = 'query:result:';
const DEFAULT_RESULT_TTL_SECONDS = 1_800;

function key(queryId: string): string {
  return `${RESULT_CACHE_PREFIX}${queryId}`;
}

function configuredTtlSeconds(): number {
  const configured = Number(process.env.RESULT_TTL_SECONDS);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_RESULT_TTL_SECONDS;
}

function assertQueryId(queryId: string): void {
  if (!queryId.trim()) {
    throw new Error('queryId é obrigatório para o cache de resultado.');
  }
}

function parsePayload<T extends ResultCachePayload>(raw: string): T {
  try {
    const payload: unknown = JSON.parse(raw);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      throw new Error('Formato de payload inválido.');
    }

    return payload as T;
  } catch {
    throw new Error('Resultado armazenado no cache está inválido.');
  }
}

export class RedisResultCache implements ResultCache {
  constructor(
    private readonly client: ResultCacheRedisClient = redis as ResultCacheRedisClient,
    private readonly defaultTtlSeconds = configuredTtlSeconds(),
  ) {}

  async get(queryId: string): Promise<ResultCachePayload | null> {
    assertQueryId(queryId);
    const raw = await this.client.get(key(queryId));

    return raw === null ? null : parsePayload<ResultCachePayload>(raw);
  }

  async set(
    queryId: string,
    payload: ResultCachePayload,
    ttlSeconds = this.defaultTtlSeconds,
  ): Promise<void> {
    assertQueryId(queryId);

    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError('O TTL do resultado deve ser um inteiro positivo.');
    }

    await this.client.set(key(queryId), JSON.stringify(payload), 'EX', ttlSeconds);
  }

  async del(queryId: string): Promise<void> {
    assertQueryId(queryId);
    await this.client.del(key(queryId));
  }
}

export const resultCache: ResultCache = new RedisResultCache();

export { RESULT_CACHE_PREFIX };
