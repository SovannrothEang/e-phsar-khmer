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
import { Public } from '../common/decorators/public.decorator';
import { SECRET_HEADER, secretMatches } from '../common/internal-secret';
import { OutboxRetention } from '../outbox/outbox-retention.service';
import { AccountPurgeService } from '../users/account-purge.service';

export interface InternalJobsSummary {
  outboxPurged: number;
  accountsPurged: number;
}

/**
 * One authenticated tick of the housekeeping that otherwise runs on an
 * in-process timer: outbox retention and the account purge.
 *
 * This is the "authenticated cron" half of the deployment model. A host that
 * scales to zero never keeps a warm instance long enough for a 6-hourly or
 * hourly `setInterval` to fire, so an external pinger calls this instead. The
 * worker role still runs both on their own schedule; calling this from a cron
 * is harmless because both sweeps are idempotent predicates (`deleted_at`
 * older than the window, `published` rows older than N days).
 *
 * Payment reconciliation is deliberately not here: it has its own route
 * (`POST /internal/payments/reconcile`) with a provider-specific summary.
 *
 * Fail-closed: no configured secret means 503, never "run with no auth".
 * Route: POST /api/v1/internal/jobs/run
 */
@ApiTags('internal')
@Controller('internal/jobs')
export class InternalJobsController {
  private readonly logger = new Logger(InternalJobsController.name);

  constructor(
    private readonly retention: OutboxRetention,
    private readonly purge: AccountPurgeService,
    private readonly config: ConfigService,
  ) {}

  @Post('run')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Run one pass of the housekeeping sweeps (requires the x-internal-secret header)',
  })
  async run(
    @Headers(SECRET_HEADER) received?: string,
  ): Promise<InternalJobsSummary> {
    const expected = this.config.get<string>('internal.secret');
    if (!expected) {
      throw new ServiceUnavailableException({
        code: 'INTERNAL_JOBS_NOT_CONFIGURED',
        message: 'Internal maintenance jobs are not configured.',
      });
    }
    if (!received || !secretMatches(received, expected)) {
      // Never log either value, only that a call was rejected.
      this.logger.warn('Rejected an internal jobs call with a bad secret');
      throw new UnauthorizedException('Invalid internal secret');
    }

    const outboxPurged = await this.retention.runOnce();
    // Throws on failure on purpose: a non-2xx is what tells the cron to retry,
    // and both sweeps are safe to run again.
    const accountsPurged = await this.purge.purgeDueAccounts();

    this.logger.log(
      `Internal job run: purged ${outboxPurged} outbox row(s), ${accountsPurged} account(s)`,
    );
    return { outboxPurged, accountsPurged };
  }
}
