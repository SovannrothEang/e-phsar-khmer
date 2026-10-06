import { Module } from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { ListingReactionsController } from './listing-reactions.controller';
import { MeReactionsController } from './me-reactions.controller';

/**
 * The likes/saves domain: the two edge tables, their toggles, and their
 * reads. Exports the service so the listings detail response can carry a live
 * like count without reaching into these tables itself.
 */
@Module({
  controllers: [ListingReactionsController, MeReactionsController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
