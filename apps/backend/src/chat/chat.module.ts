import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ConnectionRegistry } from './connection-registry';
import { HeartbeatService } from './heartbeat.service';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, ConnectionRegistry, HeartbeatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
