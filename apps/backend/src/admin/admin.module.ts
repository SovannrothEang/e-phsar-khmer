import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
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

@Module({
  imports: [FilesModule],
  controllers: [
    AdminController,
    AdminCategoriesController,
    AdminSubcategoriesController,
    AdminBrandsController,
    AdminModelsController,
    SubscriptionConfigController,
    UserSubscriptionsController,
    ReportsController,
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
  ],
  exports: [AdminService],
})
export class AdminModule {}
