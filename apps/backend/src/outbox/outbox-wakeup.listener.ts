import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OutboxDispatcher } from './outbox.dispatcher';
import { OUTBOX_WAKEUP_EVENT } from './outbox-events';

@Injectable()
export class OutboxWakeupListener {
  constructor(private readonly dispatcher: OutboxDispatcher) {}

  @OnEvent(OUTBOX_WAKEUP_EVENT)
  handle(): void {
    this.dispatcher.wakeup();
  }
}
