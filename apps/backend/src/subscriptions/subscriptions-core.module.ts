import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionActivationService } from './subscription-activation.service';
import { EntitlementsService } from './entitlements.service';
import {
  ENTITLEMENTS_QUEUE,
  EntitlementsProcessor,
  EntitlementsScheduler,
} from './entitlements-sweep.processor';

@Module({
  imports: [BullModule.registerQueue({ name: ENTITLEMENTS_QUEUE })],
  providers: [
    SubscriptionActivationService,
    EntitlementsService,
    EntitlementsScheduler,
    EntitlementsProcessor,
  ],
  exports: [SubscriptionActivationService, EntitlementsService],
})
export class SubscriptionsCoreModule {}
