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

@Module({
  imports: [
    FilesModule,
    ChatModule,
    SubscriptionsCoreModule,
    ListingsModule,
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
