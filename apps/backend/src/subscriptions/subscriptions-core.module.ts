import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionActivationService } from './subscription-activation.service';
import { EntitlementsService } from './entitlements.service';
import { ENTITLEMENTS_QUEUE } from './entitlements.constants';
import { EntitlementsProcessor } from './entitlements-sweep.processor';
import { EntitlementsScheduler } from './entitlements.scheduler';
import { backgroundProviders } from '../config/runtime-role';

@Module({
  imports: [
    BullModule.registerQueue({ name: ENTITLEMENTS_QUEUE }),
    // Reconcile is a notification producer now (`listing.restricted`), so
    // this module sends notices. NotificationsModule's own graph is the leaf
    // ChatPubSubModule + OutboxModule, so there is no cycle back here.
    NotificationsModule,
  ],
  providers: [
    SubscriptionActivationService,
    EntitlementsService,
    EntitlementsScheduler,
    // No BullMQ worker in the api role — see config/runtime-role.ts.
    ...backgroundProviders([EntitlementsProcessor]),
  ],
  exports: [
    SubscriptionActivationService,
    EntitlementsService,
    EntitlementsScheduler,
  ],
})
export class SubscriptionsCoreModule {}
