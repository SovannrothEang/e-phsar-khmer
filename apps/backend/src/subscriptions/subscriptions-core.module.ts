import { Module } from '@nestjs/common';
import { SubscriptionActivationService } from './subscription-activation.service';

@Module({
  providers: [SubscriptionActivationService],
  exports: [SubscriptionActivationService],
})
export class SubscriptionsCoreModule {}
