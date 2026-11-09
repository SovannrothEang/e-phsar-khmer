import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { redactSensitiveQuery } from '../utils/redact';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const where = `${request.method} ${redactSensitiveQuery(request.originalUrl)}`;

    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse();
      const isValidationError =
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse &&
        Array.isArray((exceptionResponse as { message: unknown }).message);

      if (isValidationError) {
        this.logger.warn(
          `${where} 400 Validation failed: ${JSON.stringify((exceptionResponse as { message: string[] }).message)}`,
        );
        return response.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Validation failed',
            details: (exceptionResponse as { message: string[] }).message,
          },
        });
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as { message?: string }).message ??
            exception.message);
      // A thrower may pass `new XException({ code, message, details })` to
      // give clients a machine-readable reason (e.g. chat E2E's 409
      // E2E_DEVICES_MISMATCH carrying which devices to add/drop). Without an
      // explicit `code`, the HTTP status name is used as before.
      const custom =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as { code?: unknown; details?: unknown })
          : {};

      // 4xx is the client's fault: one warn line. A 5xx thrown as an
      // HttpException (InternalServerErrorException, a mapped payment
      // failure) is ours, so it gets the stack like an unhandled error.
      if (status >= 500) {
        this.logger.error(`${where} ${status} ${message}`, exception.stack);
      } else {
        this.logger.warn(`${where} ${status} ${message}`);
      }

      return response.status(status).json({
        success: false,
        error: {
          code:
            typeof custom.code === 'string'
              ? custom.code
              : (HttpStatus[status] ?? 'HTTP_ERROR'),
          message,
          ...(custom.details !== undefined ? { details: custom.details } : {}),
        },
      });
    }

    this.logger.error(
      `${where} Unhandled exception`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  }
}
