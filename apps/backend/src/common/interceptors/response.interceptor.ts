import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Checked on the handler and the controller class, so `@SkipEnvelope()`
    // works either way (a whole controller, or one route).
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipEnvelope) return next.handle();

    return next.handle().pipe(
      map((value) => {
        if (typeof value === 'string') {
          return value;
        }
        if (
          value !== null &&
          typeof value === 'object' &&
          'data' in value &&
          'meta' in value
        ) {
          return {
            success: true,
            data: (value as { data: unknown }).data,
            meta: (value as { meta: unknown }).meta,
          };
        }
        return { success: true, data: value };
      }),
    );
  }
}
