import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResumeModule } from '../resume/resume.module';
import { ApplicationsService } from './applications.service';
import { ListingApplicationsController } from './listing-applications.controller';
import { MeApplicationsController } from './me-applications.controller';

/**
 * Job applications: the apply write, the two /me reads, the poster's status
 * changes, and the one application-scoped path to a résumé.
 *
 * Three imports, each doing one job — `ChatModule` for the delivery channel
 * (`ChatService.sendMessage`, the single chat write path), `NotificationsModule`
 * for the poster's feed entry (deliberately not `@Global()`: importing it is
 * this module's explicit choice to send notifications), and `ResumeModule` for
 * the CV it freezes and later signs. None of them imports this module back, and
 * `ListingsModule` is not touched at all — the listing page's "already applied"
 * read rides the `?listingId=` filter on `GET /users/me/applications`, which is
 * what keeps the graph acyclic.
 */
@Module({
  imports: [ChatModule, NotificationsModule, ResumeModule],
  controllers: [ListingApplicationsController, MeApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
