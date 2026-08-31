import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Channel } from '../utils/channel';
import { OutboxHandlerRegistry } from './outbox-handler.registry';
import { OutboxService } from './outbox.service';
import type { OutboxRecord } from './outbox.service';
import type { OutboxWakeupEvent } from './outbox-events';

/**
 * The wakeup channel carries a coalescing "work is pending" flag, not a queue
 * of items — capacity 1 is all that is meaningful, and a full buffer simply
 * means a wakeup is already pending.
 *
 * The token is a non-undefined string on purpose: `Channel.tryRead()` uses
 * `undefined` as its "buffer empty" sentinel, so a `Channel<void>` cannot tell
 * an empty buffer from a real value. Using a real token keeps this code
 * correct without touching channel.ts.
 */
type WakeupToken = 'wake';
const WAKE: WakeupToken = 'wake';

const SHUTDOWN_GRACE_MS = 10_000;

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly channel = Channel.createBounded<WakeupToken>(1);
  private readonly workers: Promise<void>[] = [];
  /** Identifies this process in `outbox_messages.locked_by`. */
  private readonly instanceId = `${process.pid}-${randomUUID().slice(0, 8)}`;

  private readonly concurrency: number;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly reclaimIntervalMs: number;
  private readonly staleLockSeconds: number;

  private running = false;
  private pollTimer?: NodeJS.Timeout;
  private reclaimTimer?: NodeJS.Timeout;

  constructor(
    private readonly outbox: OutboxService,
    private readonly handlers: OutboxHandlerRegistry,
    configService: ConfigService,
  ) {
    this.concurrency = configService.get<number>('outbox.concurrency') ?? 5;
    this.batchSize = configService.get<number>('outbox.batchSize') ?? 100;
    this.pollIntervalMs =
      configService.get<number>('outbox.pollIntervalMs') ?? 1500;
    this.reclaimIntervalMs =
      configService.get<number>('outbox.reclaimIntervalMs') ?? 60_000;
    this.staleLockSeconds =
      configService.get<number>('outbox.staleLockSeconds') ?? 300;
  }

  async onModuleInit(): Promise<void> {
    this.running = true;

    // Anything left `processing` belongs to a process that is no longer alive.
    await this.reclaim();

    // Start worker pool.
    for (let i = 0; i < this.concurrency; i++) {
      const workerId = `${this.instanceId}:${i}`;
      this.workers.push(
        this.worker(workerId).catch((error: unknown) => {
          this.logger.error(
            `[OutboxWorker:${workerId}] stopped unexpectedly`,
            error instanceof Error ? error.stack : String(error),
          );
        }),
      );
    }

    // Startup drain.
    this.wakeup('startup');

    // Polling fallback. This is NOT redundant with the event-driven wakeup:
    //   (a) EventEmitter2 is in-process only. With more than one backend
    //       instance, a row committed on instance A never wakes instance B —
    //       only a poll makes B notice it.
    //   (b) It is the retry driver. A row whose next_attempt_at is in the
    //       future has no wakeup event coming; nothing will re-emit for it.
    this.pollTimer = setInterval(
      () => this.wakeup('retry'),
      this.pollIntervalMs,
    );
    this.pollTimer.unref();

    this.reclaimTimer = setInterval(() => {
      void this.reclaim();
    }, this.reclaimIntervalMs);
    this.reclaimTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    // Stop accepting work: workers finish the batch they are on, then exit.
    this.running = false;

    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reclaimTimer) clearInterval(this.reclaimTimer);

    this.channel.writer.complete();

    // Let in-flight dispatches settle, but never block shutdown forever on a
    // handler that hangs — an abandoned row is recovered by reclaimStale.
    await Promise.race([
      Promise.allSettled(this.workers),
      new Promise<void>((resolve) =>
        setTimeout(resolve, SHUTDOWN_GRACE_MS).unref(),
      ),
    ]);
  }

  /**
   * Called whenever a new outbox record is committed.
   *
   * This does NOT perform the dispatch.
   * It only wakes the dispatcher.
   */
  wakeup(source: OutboxWakeupEvent['source'] = 'transaction'): void {
    // Returns false when a wakeup is already buffered — that is the coalescing
    // behaviour we want, not an error.
    this.channel.writer.tryWrite(WAKE);
    this.logger.debug(`wakeup (${source})`);
  }

  private async worker(workerId: string): Promise<void> {
    while (this.running) {
      try {
        const available = await this.channel.reader.waitToReadAsync();

        if (!available) {
          break;
        }

        // Consume wake-up token. All waiting workers are released by a single
        // token; only one of them actually takes it, the rest read empty and
        // drain anyway. That fan-out is intentional and safe — claimBatch uses
        // FOR UPDATE SKIP LOCKED, so they never claim overlapping rows.
        this.channel.reader.tryRead();

        // Drain all currently available work.
        await this.drain(workerId);
      } catch (error) {
        this.logger.error(
          `[OutboxWorker:${workerId}]`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async drain(workerId: string): Promise<void> {
    while (this.running) {
      const batch = await this.outbox.claimBatch(this.batchSize, workerId);

      if (batch.length === 0) {
        return;
      }

      await Promise.all(batch.map((record) => this.dispatch(record, workerId)));
    }
  }

  private async dispatch(
    record: OutboxRecord,
    workerId: string,
  ): Promise<void> {
    const handler = this.handlers.get(record.topic);

    if (!handler) {
      // Terminal: retrying an unroutable topic can never succeed, so this must
      // not burn attempts in a loop.
      this.logger.error(
        `[OutboxWorker:${workerId}] no handler registered for topic "${record.topic}" (message ${record.id})`,
      );
      await this.release(record.id, `No handler for topic "${record.topic}"`, {
        terminal: true,
      });
      return;
    }

    try {
      await handler.handle(record.payload, {
        id: record.id,
        topic: record.topic,
        aggregateId: record.aggregateId,
        attempt: record.attempts,
      });

      await this.outbox.markPublished(record.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[OutboxWorker:${workerId}] dispatch failed for ${record.topic} (message ${record.id}, attempt ${record.attempts}/${record.maxAttempts}): ${message}`,
      );
      await this.release(record.id, message);
    }
  }

  /**
   * markFailed can itself fail (e.g. the DB went away). Swallow it here so one
   * bad row cannot abort the whole batch — the row stays `processing` and is
   * picked up again by reclaimStale.
   */
  private async release(
    id: string,
    error: string,
    opts: { terminal?: boolean } = {},
  ): Promise<void> {
    try {
      await this.outbox.markFailed(id, error, opts.terminal ?? false);
    } catch (releaseError) {
      this.logger.error(
        `Failed to release outbox message ${id}`,
        releaseError instanceof Error
          ? releaseError.stack
          : String(releaseError),
      );
    }
  }

  private async reclaim(): Promise<void> {
    try {
      const reclaimed = await this.outbox.reclaimStale(this.staleLockSeconds);
      if (reclaimed > 0) {
        this.logger.warn(`Reclaimed ${reclaimed} stale outbox message(s)`);
        this.wakeup('retry');
      }
    } catch (error) {
      this.logger.error(
        'Failed to reclaim stale outbox messages',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
