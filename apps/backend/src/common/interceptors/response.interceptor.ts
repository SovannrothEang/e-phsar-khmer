import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
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
