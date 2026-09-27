import { Redis } from 'ioredis';
import type { Redis as RedisClient } from 'ioredis';

/**
 * Creates a Redis connection with the options required by BullMQ.
 *
 * The connection is lazy so importing core from an API process does not open a
 * socket until a queue, cache, or pub/sub operation actually needs Redis.
 */
export function createRedisClient(url = process.env.REDIS_URL): RedisClient {
  if (!url) {
    throw new Error('REDIS_URL não configurada.');
  }

  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}

// Core is also imported by unit tests and queue declarations before the API
// config module has parsed environment variables. Keep the connection lazy and
// point that import-time fallback at local Redis; API/worker boot still validate
// their required environment before doing real work.
export const redis = createRedisClient(process.env.REDIS_URL ?? 'redis://localhost:6379');

export async function closeRedisClient(client: RedisClient = redis): Promise<void> {
  if (client.status === 'end') {
    return;
  }

  await client.quit();
}
