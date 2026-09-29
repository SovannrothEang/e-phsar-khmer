import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse();
      const isValidationError =
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse &&
        Array.isArray((exceptionResponse as { message: unknown }).message);

      if (isValidationError) {
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
      'Unhandled exception',
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
