import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { FilesModule } from '../files/files.module';
import { ReactionsModule } from '../reactions/reactions.module';
import { SubscriptionsCoreModule } from '../subscriptions/subscriptions-core.module';

@Module({
  imports: [FilesModule, ReactionsModule, SubscriptionsCoreModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
