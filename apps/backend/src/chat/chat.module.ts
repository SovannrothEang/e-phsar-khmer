import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatPubSubService } from './chat-pubsub.service';
import { ChatMetricsService } from './chat-metrics.service';
import { ConnectionRegistry } from './connection-registry';
import { HeartbeatService } from './heartbeat.service';
import { E2eKeysController } from './e2e/e2e-keys.controller';
import { E2eKeysService } from './e2e/e2e-keys.service';
import { E2eDevicesController } from './e2e/e2e-devices.controller';
import { E2eBackupController } from './e2e/e2e-backup.controller';
import { E2eBackupService } from './e2e/e2e-backup.service';
import { E2eNudgeController } from './e2e/e2e-nudge.controller';
import { E2eNudgeService } from './e2e/e2e-nudge.service';
import { ChatAttachmentsController } from './chat-attachments.controller';
import { ChatAttachmentsService } from './chat-attachments.service';
import {
  CHAT_MAINTENANCE_QUEUE,
  ChatMaintenanceProcessor,
  ChatMaintenanceScheduler,
} from './chat-maintenance.processor';

@Module({
  imports: [
    AuthModule,
    // forwardRef: NotificationsModule imports ChatModule back (for the
    // realtime push channel) — E2eNudgeService is the other half of that
    // cycle, needing NotificationsService to post the nudge.
    forwardRef(() => NotificationsModule),
    // Attachment cleanup only — see chat-maintenance.processor.ts.
    BullModule.registerQueue({ name: CHAT_MAINTENANCE_QUEUE }),
  ],
  controllers: [
    ChatController,
    E2eKeysController,
    E2eDevicesController,
    E2eBackupController,
    E2eNudgeController,
    ChatAttachmentsController,
  ],
  providers: [
    ChatService,
    ChatPubSubService,
    ChatMetricsService,
    ConnectionRegistry,
    HeartbeatService,
    ChatGateway,
    E2eKeysService,
    E2eBackupService,
    E2eNudgeService,
    ChatAttachmentsService,
    ChatMaintenanceScheduler,
    ChatMaintenanceProcessor,
  ],
  // ChatPubSubService is exported for NotificationsModule's realtime channel —
  // the per-tab socket is the app's only push transport today.
  exports: [ChatService, ChatMetricsService, ChatPubSubService],
})
export class ChatModule {}
