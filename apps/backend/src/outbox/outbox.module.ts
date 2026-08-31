import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OutboxHandlerRegistry } from './outbox-handler.registry';
import { OutboxWakeupListener } from './outbox-wakeup.listener';

@Module({
  providers: [
    OutboxService,
    OutboxHandlerRegistry,
    OutboxDispatcher,
    OutboxWakeupListener,
  ],
  // OutboxService so features can enqueue inside their own transaction;
  // OutboxHandlerRegistry so they can register a handler for their topic.
  exports: [OutboxService, OutboxHandlerRegistry],
})
export class OutboxModule {}
