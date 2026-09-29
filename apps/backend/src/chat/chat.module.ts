import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
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

@Module({
  imports: [AuthModule],
  controllers: [
    ChatController,
    E2eKeysController,
    E2eDevicesController,
    E2eBackupController,
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
  ],
  exports: [ChatService, ChatMetricsService],
})
export class ChatModule {}
