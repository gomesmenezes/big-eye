import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { ERROR_CODES, type ErrorCode } from '@big-eye/contracts';

import { AppLogger } from '../logger.js';

type ErrorResponse = {
  code: string;
  message: string;
  statusCode: number;
};

type RequestContext = { method: string; routeOptions?: { url?: string } };
type ReplyContext = { status: (statusCode: number) => { send: (body: ErrorResponse) => unknown } };

const safeErrors: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: {
    code: ERROR_CODES.INVALID_INPUT,
    message: 'A requisição contém dados inválidos.',
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: ERROR_CODES.UNAUTHORIZED,
    message: 'Autenticação necessária.',
  },
  [HttpStatus.FORBIDDEN]: {
    code: ERROR_CODES.FORBIDDEN,
    message: 'Acesso não permitido.',
  },
  [HttpStatus.NOT_FOUND]: {
    code: 'NOT_FOUND',
    message: 'Recurso não encontrado.',
  },
  [HttpStatus.PAYMENT_REQUIRED]: {
    code: ERROR_CODES.INSUFFICIENT_CREDITS,
    message: 'Créditos insuficientes.',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Limite de requisições excedido.',
  },
  [HttpStatus.BAD_GATEWAY]: {
    code: ERROR_CODES.PROVIDER_UNAVAILABLE,
    message: 'Provedor temporariamente indisponível.',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Serviço temporariamente indisponível.',
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor.',
  },
};

const codeStatuses: Record<ErrorCode, number> = {
  [ERROR_CODES.INSUFFICIENT_CREDITS]: HttpStatus.PAYMENT_REQUIRED,
  [ERROR_CODES.MODULE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ERROR_CODES.INVALID_INPUT]: HttpStatus.BAD_REQUEST,
  [ERROR_CODES.QUERY_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ERROR_CODES.PROVIDER_UNAVAILABLE]: HttpStatus.BAD_GATEWAY,
  [ERROR_CODES.PAYMENT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ERROR_CODES.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ERROR_CODES.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
};

const safeMessages: Record<ErrorCode, string> = {
  [ERROR_CODES.INSUFFICIENT_CREDITS]: 'Créditos insuficientes.',
  [ERROR_CODES.MODULE_NOT_FOUND]: 'Chamada/Consulta não encontrada.',
  [ERROR_CODES.INVALID_INPUT]: 'A requisição contém dados inválidos.',
  [ERROR_CODES.QUERY_FAILED]: 'A consulta não pôde ser concluída.',
  [ERROR_CODES.PROVIDER_UNAVAILABLE]: 'Provedor temporariamente indisponível.',
  [ERROR_CODES.PAYMENT_NOT_FOUND]: 'Pagamento não encontrado.',
  [ERROR_CODES.FORBIDDEN]: 'Acesso não permitido.',
  [ERROR_CODES.UNAUTHORIZED]: 'Autenticação necessária.',
};

function knownErrorCode(value: unknown): ErrorCode | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return Object.values(ERROR_CODES).find((code) => code === value);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestContext>();
    const reply = context.getResponse<ReplyContext>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const response = exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseCode =
      typeof response === 'object' && response !== null && 'code' in response
        ? knownErrorCode(response.code)
        : undefined;
    const error = responseCode && codeStatuses[responseCode] === statusCode
      ? { code: responseCode, message: safeMessages[responseCode] }
      : safeErrors[statusCode] ?? {
      code: `HTTP_${statusCode}`,
      message: statusCode < 500 ? 'A requisição não pôde ser concluída.' : 'Erro interno do servidor.',
        };
    const body: ErrorResponse = { ...error, statusCode };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const errorCode =
        typeof exception === 'object' && exception !== null && 'code' in exception &&
        typeof exception.code === 'string' && /^P\d{4}$/u.test(exception.code)
          ? exception.code
          : undefined;
      this.logger.reportHttpException(
        request.method,
        statusCode,
        request.routeOptions?.url,
        exception instanceof Error ? exception.constructor.name : typeof exception,
        errorCode,
      );
    }

    void reply.status(statusCode).send(body);
  }
}
