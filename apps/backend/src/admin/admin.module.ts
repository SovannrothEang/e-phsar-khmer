import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ChatModule } from '../chat/chat.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService } from './admin-categories.service';
import { AdminSubcategoriesController } from './admin-subcategories.controller';
import { AdminSubcategoriesService } from './admin-subcategories.service';
import { AdminBrandsController } from './admin-brands.controller';
import { AdminBrandsService } from './admin-brands.service';
import { AdminModelsController } from './admin-models.controller';
import { AdminModelsService } from './admin-models.service';
import { SubscriptionConfigController } from './subscriptions/subscription-config.controller';
import { SubscriptionConfigService } from './subscriptions/subscription-config.service';
import { UserSubscriptionsController } from './subscriptions/user-subscriptions.controller';
import { UserSubscriptionsService } from './subscriptions/user-subscriptions.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { SubscriptionsCoreModule } from '../subscriptions/subscriptions-core.module';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminListingsController } from './admin-listings.controller';
import { AdminListingsService } from './admin-listings.service';
import { AdminSmsDeliveriesController } from './admin-sms-deliveries.controller';
import { AdminSmsDeliveriesService } from './admin-sms-deliveries.service';
import { AdminSettingsController } from './admin-settings.controller';
import { SettingsModule } from '../settings/settings.module';
import { ChatPubSubModule } from '../chat/chat-pubsub.module';

@Module({
  imports: [
    FilesModule,
    ChatModule,
    SubscriptionsCoreModule,
    ListingsModule,
    // Runtime policy (moderation threshold, support contacts). Explicit import,
    // not `@Global()` — only modules that read a setting should depend on it.
    SettingsModule,
    // The leaf pub/sub transport, not `ChatModule`: a suspension announces
    // itself to every instance so live sockets close. Importing `ChatModule`
    // here would re-introduce the cycle its own comment warns about.
    ChatPubSubModule,
    // Importing it is a choice to send notifications: moderation take-downs
    // and inactivations tell the seller why. Not global; no cycle (it depends
    // only on the pubsub leaf).
    NotificationsModule,
  ],
  controllers: [
    AdminController,
    AdminCategoriesController,
    AdminSubcategoriesController,
    AdminBrandsController,
    AdminModelsController,
    SubscriptionConfigController,
    UserSubscriptionsController,
    ReportsController,
    AdminListingsController,
    AdminSmsDeliveriesController,
    AdminSettingsController,
  ],
  providers: [
    AdminService,
    AdminCategoriesService,
    AdminSubcategoriesService,
    AdminBrandsService,
    AdminModelsService,
    SubscriptionConfigService,
    UserSubscriptionsService,
    ReportsService,
    AdminListingsService,
    AdminSmsDeliveriesService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
