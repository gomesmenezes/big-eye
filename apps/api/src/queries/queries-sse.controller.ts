import {
  Controller,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { z } from 'zod';

import type { PrismaClient } from '@big-eye/core/db/prisma-client';
import { QueryStatus } from '@big-eye/core/db/prisma-client';
import {
  queryEventsBus,
  type QueryEventPayload,
  type QueryEventsBus,
} from '@big-eye/core/query-events';
import { resultCache, type ResultCache } from '@big-eye/core/result-cache';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PRISMA } from '../db/database.module.js';

export const QUERY_EVENTS_BUS = Symbol('QUERY_EVENTS_BUS');
export const RESULT_CACHE = Symbol('RESULT_CACHE');

const queryIdSchema = z.string().uuid();

type QuerySnapshot = {
  status: QueryEventPayload['status'];
  data?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  resultExpired?: boolean;
};

function isTerminal(status: QueryStatus): boolean {
  return (
    status === QueryStatus.succeeded ||
    status === QueryStatus.failed ||
    status === QueryStatus.refunded
  );
}

@Controller('queries')
export class QueriesSseController {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Optional() @Inject(QUERY_EVENTS_BUS) private readonly injectedEventsBus?: QueryEventsBus,
    @Optional() @Inject(RESULT_CACHE) private readonly injectedResultCache?: ResultCache,
  ) {}

  @Sse(':id/stream')
  async stream(
    @Param('id') id: string,
    @CurrentUser() user: ApiUser,
  ): Promise<Observable<MessageEvent>> {
    if (!queryIdSchema.safeParse(id).success) {
      throw new NotFoundException();
    }

    const query = await this.prisma.query.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!query) {
      throw new NotFoundException();
    }

    const events = this.injectedEventsBus ?? queryEventsBus;
    const cache = this.injectedResultCache ?? resultCache;

    return new Observable<MessageEvent>((subscriber) => {
      let disposed = false;
      let unsubscribe: (() => Promise<void>) | undefined;

      const close = (): void => {
        if (disposed) {
          return;
        }

        disposed = true;
        subscriber.complete();
        if (unsubscribe) {
          void unsubscribe();
        }
      };

      const emit = (payload: QuerySnapshot, terminal: boolean): void => {
        if (disposed) {
          return;
        }

        subscriber.next({ data: payload });
        if (terminal) {
          close();
        }
      };

      const snapshot = async (): Promise<QuerySnapshot> => {
        const current = await this.prisma.query.findFirst({
          where: { id, userId: user.id },
          select: {
            status: true,
            errorCode: true,
            errorMessage: true,
          },
        });

        if (!current) {
          throw new NotFoundException();
        }

        if (current.status !== QueryStatus.succeeded) {
          const payload: QuerySnapshot = {
            status: current.status,
          };

          if (current.errorCode) {
            payload.errorCode = current.errorCode;
          }
          if (current.errorMessage) {
            payload.errorMessage = current.errorMessage;
          }

          return payload;
        }

        const cached = await cache.get(id);
        return cached
          ? { status: QueryStatus.succeeded, data: cached.data }
          : { status: QueryStatus.succeeded, resultExpired: true };
      };

      const emitEvent = async (event: QueryEventPayload): Promise<void> => {
        if (disposed) {
          return;
        }

        if (event.status !== QueryStatus.succeeded) {
          emit(event, isTerminal(event.status as QueryStatus));
          return;
        }

        const cached = await cache.get(id);
        emit(
          cached
            ? { ...event, data: cached.data }
            : { ...event, resultExpired: true },
          true,
        );
      };

      const start = async (): Promise<void> => {
        try {
          unsubscribe = await events.subscribe(id, (event) =>
            emitEvent(event).catch((error: unknown) => {
              if (!disposed) {
                disposed = true;
                subscriber.error(error);
              }
            }),
          );
          const current = await snapshot();
          emit(current, isTerminal(current.status as QueryStatus));
        } catch (error) {
          if (!disposed) {
            disposed = true;
            subscriber.error(error);
          }
        }
      };

      void start();

      return () => {
        disposed = true;
        if (unsubscribe) {
          void unsubscribe();
        }
      };
    });
  }
}
