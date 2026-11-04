import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import type { RequestUser } from '../common/types/api-response.types';
import { RecordEventsDto } from './dto/record-events.dto';
import { InsightsService } from './insights.service';

@ApiTags('insights')
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  /**
   * The public ingestion door. It must stay public: most marketplace traffic
   * (feed impressions, detail views) is anonymous. A present Bearer token is
   * verified so the listing owner's own actions can be excluded.
   *
   * Throttled since the 2026-11-03 review. The web calls this through a Next
   * server action, so anonymous traffic shares the Next/Vercel egress IP and
   * this bucket is effectively one site-wide budget, not a per-visitor one —
   * hence 600/min (10/s) rather than a per-user number: high enough not to
   * drop ordinary beacon traffic, low enough to bound a flood. Because the
   * route is `@Public()`, the global JwtAuthGuard does not run, so the
   * throttler keys even token-carrying calls by IP. The DTO's 50-event cap
   * still bounds each payload; this bucket bounds how often the write is hit.
   */
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Post('events')
  @ApiOperation({ summary: 'Record a batch of listing interactions' })
  record(
    @CurrentUser() user: RequestUser | null,
    @Body() dto: RecordEventsDto,
  ) {
    return this.insightsService.record(user?.id ?? null, dto.events);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Account-wide interaction summary for my listings' })
  mySummary(@CurrentUser() user: RequestUser) {
    return this.insightsService.summary(user.id);
  }
}
