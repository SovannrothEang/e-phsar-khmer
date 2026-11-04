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
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SECRET_HEADER, secretMatches } from '../../common/internal-secret';
import { PaymentReconciler } from '../reconciler/payment-reconciler.service';
import type { ReconcileSummary } from '../reconciler/payment-reconciler.service';

export { SECRET_HEADER };

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
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Run one payment reconciliation pass (requires the x-internal-secret header)',
  })
  async reconcile(
    @Headers(SECRET_HEADER) received?: string,
  ): Promise<ReconcileSummary> {
    const expected = this.config.get<string>('internal.secret');
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
    // `PAYMENT_RECONCILER_ENABLED=false` only turns off the in-process timer
    // (the cost saving on a scale-to-zero host); an explicit, authenticated
    // wake-up is exactly what should still work there.
    const providers =
      this.config.get<string[]>('payment.reconcileProviders') ?? [];
    if (providers.length === 0) {
      throw new ServiceUnavailableException({
        code: 'RECONCILE_NO_PROVIDERS',
        message: 'No payment provider is configured for reconciliation.',
      });
    }

    return this.reconciler.runExclusive();
  }
}
