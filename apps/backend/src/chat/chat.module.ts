import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ConnectionRegistry } from './connection-registry';
import { HeartbeatService } from './heartbeat.service';
import { E2eKeysController } from './e2e/e2e-keys.controller';
import { E2eKeysService } from './e2e/e2e-keys.service';

@Module({
  imports: [AuthModule],
  controllers: [ChatController, E2eKeysController],
  providers: [
    ChatService,
    ConnectionRegistry,
    HeartbeatService,
    ChatGateway,
    E2eKeysService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
