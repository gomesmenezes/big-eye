import type { Redis } from 'ioredis';

import { redis } from './redis.js';

export type QueryEventStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'refunded';

export type QueryEventPayload = {
  status: QueryEventStatus;
  data?: unknown;
  errorCode?: string;
  errorMessage?: string;
  resultExpired?: boolean;
};

export type QueryEventHandler = (event: QueryEventPayload) => void | Promise<void>;

export interface QueryEventsBus {
  publish(queryId: string, event: QueryEventPayload): Promise<void>;
  subscribe(queryId: string, handler: QueryEventHandler): Promise<() => Promise<void>>;
}

const QUERY_EVENTS_PREFIX = 'query:events:';

export function queryEventsChannel(queryId: string): string {
  if (!queryId.trim()) {
    throw new Error('queryId é obrigatório para o bus de eventos.');
  }

  return `${QUERY_EVENTS_PREFIX}${queryId}`;
}

function parseEvent(raw: string): QueryEventPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { status?: unknown }).status !== 'string'
    ) {
      return null;
    }

    return parsed as QueryEventPayload;
  } catch {
    return null;
  }
}

/** Redis pub/sub implementation shared by the API and worker processes. */
export class RedisQueryEventsBus implements QueryEventsBus {
  constructor(
    private readonly publisher: Redis = redis,
    private readonly subscriberFactory: () => Redis = () => publisher.duplicate(),
  ) {}

  async publish(queryId: string, event: QueryEventPayload): Promise<void> {
    await this.publisher.publish(queryEventsChannel(queryId), JSON.stringify(event));
  }

  async subscribe(
    queryId: string,
    handler: QueryEventHandler,
  ): Promise<() => Promise<void>> {
    const channel = queryEventsChannel(queryId);
    const subscriber = this.subscriberFactory();
    const onMessage = (receivedChannel: string, raw: string): void => {
      if (receivedChannel !== channel) {
        return;
      }

      const event = parseEvent(raw);
      if (event) {
        void handler(event);
      }
    };

    subscriber.on('message', onMessage);
    await subscriber.subscribe(channel);

    let closed = false;
    return async (): Promise<void> => {
      if (closed) {
        return;
      }

      closed = true;
      subscriber.off('message', onMessage);
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    };
  }
}

/** Small deterministic bus for unit tests and local in-process consumers. */
export class InMemoryQueryEventsBus implements QueryEventsBus {
  private readonly handlers = new Map<string, Set<QueryEventHandler>>();

  async publish(queryId: string, event: QueryEventPayload): Promise<void> {
    const handlers = this.handlers.get(queryId);
    if (!handlers) {
      return;
    }

    await Promise.all([...handlers].map((handler) => handler(event)));
  }

  async subscribe(
    queryId: string,
    handler: QueryEventHandler,
  ): Promise<() => Promise<void>> {
    const handlers = this.handlers.get(queryId) ?? new Set<QueryEventHandler>();
    handlers.add(handler);
    this.handlers.set(queryId, handlers);

    let closed = false;
    return async (): Promise<void> => {
      if (closed) {
        return;
      }

      closed = true;
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(queryId);
      }
    };
  }
}

export const queryEventsBus: QueryEventsBus = new RedisQueryEventsBus();

export { QUERY_EVENTS_PREFIX };
