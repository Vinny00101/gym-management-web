import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { getRequestId } from '../middleware/request-id.middleware.js';

type ApiErrorResponse = {
  code: string;
  message: string;
  requestId: string;
  details?: string[];
};

const ERROR_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = getRequestId(request);
    response.setHeader('X-Request-Id', requestId);

    const apiError = this.getApiError(exception, requestId);
    if (apiError.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const error =
        exception instanceof Error ? exception : new Error('Unknown exception');
      this.logger.error(error.message, error.stack);
    }

    response.status(apiError.status).json(apiError.body);
  }

  private getApiError(
    exception: unknown,
    requestId: string,
  ): { status: number; body: ApiErrorResponse } {
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          code: 'CONFLICT',
          message: 'A record with the provided unique value already exists.',
          requestId,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        return {
          status,
          body: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
            requestId,
          },
        };
      }

      const exceptionResponse = exception.getResponse();
      const responseBody = isRecord(exceptionResponse) ? exceptionResponse : {};
      const responseMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : responseBody.message;
      const details =
        status === HttpStatus.BAD_REQUEST && Array.isArray(responseMessage)
          ? responseMessage.filter(
              (detail): detail is string => typeof detail === 'string',
            )
          : undefined;

      return {
        status,
        body: {
          code: ERROR_CODES[status] ?? 'HTTP_ERROR',
          message: details
            ? 'Validation failed'
            : typeof responseMessage === 'string'
              ? responseMessage
              : exception.message,
          requestId,
          ...(details ? { details } : {}),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId,
      },
    };
  }
}
