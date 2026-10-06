import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestUser } from '../types/api-response.types';

// Nest logs nothing per request by default, so without this the console is
// silent between boot and the first unhandled crash. One line per request,
// written when the response finishes (status + duration are known, and
// req.user has been set by JwtAuthGuard by then).
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    // The Docker healthcheck hits /health every 10 s; logging it buries
    // everything else.
    if (req.originalUrl === '/health') return next();

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const user = (req as Request & { user?: RequestUser }).user;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms${user ? ` user=${user.id}` : ''}`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
