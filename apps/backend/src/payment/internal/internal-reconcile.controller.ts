import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentReconciler } from '../reconciler/payment-reconciler.service';
import type { ReconcileSummary } from '../reconciler/payment-reconciler.service';

const SECRET_HEADER = 'x-internal-secret';

/**
 * Compares two secrets without leaking length or content through timing:
 * both sides are hashed to a fixed 32 bytes first. A plain
 * `timingSafeEqual(Buffer.from(a), Buffer.from(b))` would throw on a length
 * mismatch and is only constant-time for equal-length inputs.
 */
function secretMatches(received: string, expected: string): boolean {
  const a = createHash('sha256').update(received).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The wake-up for a provider with no webhook (Bakong) when nobody is on a
 * checkout page. An external pinger/cron calls this every few minutes; the
 * pass itself is the same idempotent `runOnce` the in-process timer runs, so
 * several callers overlapping is safe.
 *
 * Fail-closed: no configured secret means the route answers 503, never "run
 * with no auth". A wrong/missing header is a 401 before anything is touched.
 *
 * Route: POST /api/v1/internal/payments/reconcile
 */
@ApiTags('internal')
@Controller('internal/payments')
export class InternalReconcileController {
  private readonly logger = new Logger(InternalReconcileController.name);

  constructor(
    private readonly reconciler: PaymentReconciler,
    private readonly config: ConfigService,
  ) {}

  @Post('reconcile')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Run one payment reconciliation pass (requires the x-internal-secret header)',
  })
  async reconcile(
    @Headers(SECRET_HEADER) received?: string,
  ): Promise<ReconcileSummary> {
    const expected = this.config.get<string>('payment.internalReconcileSecret');
    if (!expected) {
      throw new ServiceUnavailableException({
        code: 'RECONCILE_NOT_CONFIGURED',
        message: 'Payment reconciliation is not configured.',
      });
    }
    if (!received || !secretMatches(received, expected)) {
      // Never log either value, only that a call was rejected.
      this.logger.warn('Rejected an internal reconcile call with a bad secret');
      throw new UnauthorizedException('Invalid internal secret');
    }
    if (!this.config.get<boolean>('payment.reconcilerEnabled')) {
      throw new ServiceUnavailableException({
        code: 'RECONCILE_DISABLED',
        message: 'Payment reconciliation is disabled in this environment.',
      });
    }

    return this.reconciler.runOnce();
  }
}
