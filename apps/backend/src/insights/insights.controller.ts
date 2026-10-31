import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
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
   * Deliberately unthrottled: the web calls this through a Next server action,
   * so every visitor shares the Next/Vercel egress IP; an IP-keyed bucket
   * would throttle the whole site together. The DTO's 50-event cap is the
   * bound — see the module README / plan for the trade-off.
   */
  @Public()
  @SkipThrottle()
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
