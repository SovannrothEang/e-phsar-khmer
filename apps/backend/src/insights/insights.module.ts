import { Module } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

/**
 * Listing interaction tracking and the owner's `/insight` summary. The module
 * owns one fact table and two routes; it imports nothing, because DbModule is
 * global and the optional guard reuses the `jwt` strategy AuthModule already
 * registers app-wide.
 */
@Module({
  controllers: [InsightsController],
  providers: [InsightsService, OptionalJwtAuthGuard],
})
export class InsightsModule {}
