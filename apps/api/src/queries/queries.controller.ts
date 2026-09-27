import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Body,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CreateQueryBody,
  ERROR_CODES,
  MODULES,
  QueryDTO,
  type CreateQueryBodyType,
} from '@big-eye/contracts';
import {
  InsufficientCreditsError,
} from '@big-eye/core/credits/credits.service';
import {
  QueryNotFoundError,
  QueryServiceError,
  QueriesService,
  type QueryView,
} from '@big-eye/core/queries/queries.service';

import type { ApiUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

class QueryResponseDto extends createZodDto(QueryDTO) {}

type ResponseWithStatus = { statusCode: number };

function queryErrorResponse(error: unknown): never {
  if (error instanceof QueryNotFoundError) {
    throw new HttpException({ code: 'NOT_FOUND' }, HttpStatus.NOT_FOUND);
  }

  if (error instanceof InsufficientCreditsError) {
    throw new HttpException(
      { code: ERROR_CODES.INSUFFICIENT_CREDITS },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  if (error instanceof QueryServiceError) {
    const status = {
      [ERROR_CODES.INSUFFICIENT_CREDITS]: HttpStatus.PAYMENT_REQUIRED,
      [ERROR_CODES.MODULE_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ERROR_CODES.INVALID_INPUT]: HttpStatus.BAD_REQUEST,
      [ERROR_CODES.QUERY_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
      [ERROR_CODES.PROVIDER_UNAVAILABLE]: HttpStatus.BAD_GATEWAY,
      [ERROR_CODES.PAYMENT_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ERROR_CODES.FORBIDDEN]: HttpStatus.FORBIDDEN,
      [ERROR_CODES.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
    }[error.code];

    throw new HttpException({ code: error.code }, status ?? HttpStatus.INTERNAL_SERVER_ERROR);
  }

  throw error;
}

function parseCreateBody(body: unknown): CreateQueryBodyType {
  const parsed = CreateQueryBody.safeParse(body);

  if (!parsed.success) {
    throw new BadRequestException({ code: ERROR_CODES.INVALID_INPUT });
  }

  return parsed.data;
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function parseCursor(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!z.string().uuid().safeParse(value).success) {
    throw new BadRequestException({ code: ERROR_CODES.INVALID_INPUT });
  }

  return value;
}

@ApiTags('queries')
@ApiBearerAuth()
@Controller()
export class QueriesController {
  constructor(@Inject(QueriesService) private readonly queriesService: QueriesService) {}

  @Post('queries')
  @ApiOkResponse({ type: QueryResponseDto })
  @ZodSerializerDto(QueryResponseDto)
  async create(
    @CurrentUser() user: ApiUser,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: ResponseWithStatus,
  ): Promise<QueryView> {
    const request = parseCreateBody(body);

    try {
      const query = await this.queriesService.create(
        user.id,
        request.moduleSlug,
        request.input,
        idempotencyKey,
      );
      response.statusCode = query.mode === 'async' ? HttpStatus.ACCEPTED : HttpStatus.OK;
      return query;
    } catch (error) {
      return queryErrorResponse(error);
    }
  }

  @Get('queries')
  async list(
    @CurrentUser() user: ApiUser,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
  ): Promise<QueryView[]> {
    try {
      return await this.queriesService.list(user.id, {
        limit: parseLimit(limit),
        cursor: parseCursor(cursor),
      });
    } catch (error) {
      return queryErrorResponse(error);
    }
  }

  @Get('queries/:id')
  @ApiOkResponse({ type: QueryResponseDto })
  @ZodSerializerDto(QueryResponseDto)
  async get(
    @CurrentUser() user: ApiUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QueryView> {
    try {
      return await this.queriesService.get(user.id, id);
    } catch (error) {
      return queryErrorResponse(error);
    }
  }

  @Get('modules')
  async modules() {
    return MODULES.map((module) =>
      Object.fromEntries(
        Object.entries(module).filter(([key]) => key !== 'input' && key !== 'output'),
      ),
    );
  }
}
