import { Module } from '@nestjs/common';
import { OutboxDispatcher } from './outbox-dispatcher.service';
import { OutboxRegistry } from './outbox-registry.service';
import { OutboxService } from './outbox.service';
import { OutboxWakeupListener } from './outbox-wakeup.listener';
import { OutboxWorker } from './outbox-worker.service';
import { OutboxRetention } from './outbox-retention.service';

/**
 * Transactional outbox + its Postgres-backed worker pool.
 *
 * Generic infrastructure: it knows how to store, claim, retry and abandon an
 * integration event, and nothing about what any event means. Producers import
 * this module, enqueue inside their own transaction, and register a handler
 * with `OutboxRegistry`.
 *
 * Not `@Global()` — unlike `DbModule`, an importer is making a real
 * architectural choice (this module now produces or consumes events), and
 * that should be visible in its imports.
 */
@Module({
  providers: [
    OutboxService,
    OutboxRegistry,
    OutboxDispatcher,
    OutboxWorker,
    OutboxWakeupListener,
    OutboxRetention,
  ],
  exports: [
    OutboxService,
    OutboxRegistry,
    OutboxDispatcher,
    OutboxWorker,
    OutboxRetention,
  ],
})
export class OutboxModule {}
