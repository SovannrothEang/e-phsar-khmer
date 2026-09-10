import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OUTBOX_WAKEUP_EVENT } from './outbox-events';
import { OutboxWorker } from './outbox-worker.service';

/**
 * Turns the producer's local wakeup event into a capacity-1 wakeup token.
 *
 * The channel is owned by the worker pool; this listener only bridges the
 * EventEmitter boundary. A full buffer simply means a wakeup is already
 * pending, so `tryWrite` coalescing is the intended behaviour, not an error.
 */
@Injectable()
export class OutboxWakeupListener {
  constructor(private readonly worker: OutboxWorker) {}

  @OnEvent(OUTBOX_WAKEUP_EVENT)
  handleWakeup(): void {
    this.worker.wakeup();
  }
}
