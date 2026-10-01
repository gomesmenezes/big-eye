import { HttpException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ERROR_CODES } from '@big-eye/contracts';

import { AppLogger } from '../logger.js';

import { HttpExceptionFilter } from './http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  it('keeps stable contract codes and replaces unsafe exception messages', () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST' }),
        getResponse: () => reply,
      }),
    } as unknown as ArgumentsHost;
    const filter = new HttpExceptionFilter();
    const reportError = vi.spyOn(AppLogger.prototype, 'reportHttpException').mockImplementation(() => undefined);

    filter.catch(
      new HttpException(
        { code: ERROR_CODES.PROVIDER_UNAVAILABLE, message: 'upstream credential leaked' },
        502,
      ),
      context,
    );

    expect(reply.status).toHaveBeenCalledWith(502);
    expect(reply.send).toHaveBeenCalledWith({
      code: ERROR_CODES.PROVIDER_UNAVAILABLE,
      message: 'Provedor temporariamente indisponível.',
      statusCode: 502,
    });
    expect(reportError).toHaveBeenCalledWith('POST', 502, undefined, 'HttpException', undefined);
    reportError.mockRestore();
  });
});
