import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel } from '../utils/channel';
import { OutboxDispatcher } from './outbox-dispatcher.service';
import { OutboxService } from './outbox.service';

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

/**
 * The background worker: Postgres is the queue, this is the consumer pool.
 *
 * It runs in-process on every API instance. That is safe because claiming
 * is atomic (`FOR UPDATE SKIP LOCKED`), so N instances simply drain the
 * table N times faster — no leader election, no broker. Set
 * `OUTBOX_WORKER_ENABLED=false` to run an instance as API-only and let a
 * dedicated deployment do the draining.
 *
 * The trigger is event-driven (a producer's `wakeupAfterCommit`), backed by
 * a poll-fallback timeout — the safety net for a lost wakeup and the
 * steady-state heartbeat that picks up rows whose backoff expired while
 * nothing new enqueued. The pool stays bounded: fixed worker count, capacity-1
 * channel, capped batch — memory is O(workers + batch); the durable backlog
 * lives in `outbox_events`, never in RAM.
 */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly channel = Channel.createBounded<WakeupToken>(1);
  private readonly workers: Promise<void>[] = [];
  private running = false;

  private readonly concurrency: number;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly dispatcher: OutboxDispatcher,
    private readonly outbox: OutboxService,
    private readonly configService: ConfigService,
  ) {
    this.concurrency =
      this.configService.get<number>('outbox.workerConcurrency') ?? 5;
    this.pollIntervalMs =
      this.configService.get<number>('outbox.pollIntervalMs') ?? 2000;
    this.batchSize = this.configService.get<number>('outbox.batchSize') ?? 10;
  }

  onApplicationBootstrap(): void {
    if (this.configService.get<boolean>('outbox.workerEnabled') === false) {
      this.logger.log('Outbox worker disabled by configuration');
      return;
    }

    this.running = true;
    this.logger.log(
      `Outbox worker started as ${this.outbox.instanceId} ` +
        `(concurrency ${this.concurrency}, poll ${this.pollIntervalMs}ms, ` +
        `batch ${this.batchSize})`,
    );

    for (let i = 0; i < this.concurrency; i++) {
      const workerId = `${this.outbox.instanceId}:${i}`;
      this.workers.push(
        this.worker(workerId).catch((error: unknown) => {
          this.logger.error(
            `[OutboxWorker:${workerId}] stopped unexpectedly`,
            error instanceof Error ? error.stack : String(error),
          );
        }),
      );
    }

    // Startup drain: wake the pool once so any backlog committed before this
    // process booted is claimed without waiting for the poll fallback.
    this.wakeup();
  }

  async onModuleDestroy(): Promise<void> {
    // Stop accepting work: workers finish the batch they are on, then exit.
    this.running = false;

    // Releasing blocked readers is what lets the worker loops observe
    // `running === false` and unwind.
    this.channel.writer.complete();

    // Let in-flight dispatches settle, but never block shutdown forever on a
    // handler that hangs — an abandoned row is recovered by the stale-lease
    // claim predicate.
    await Promise.race([
      Promise.allSettled(this.workers),
      new Promise<void>((resolve) =>
        setTimeout(resolve, SHUTDOWN_GRACE_MS).unref(),
      ),
    ]);
  }

  /**
   * Called by the wakeup listener once a producer's transaction commits.
   *
   * This does NOT perform the dispatch — it only wakes one worker. `tryWrite`
   * returning false means a wakeup is already buffered; that is coalescing,
   * not an error.
   */
  wakeup(): void {
    this.channel.writer.tryWrite(WAKE);
  }

  /**
   * One drain. Exposed for tests and for anything that wants to drain the
   * outbox on demand; the loop is just this behind the wakeup channel.
   */
  async runOnce(): Promise<number> {
    const outcomes = await this.dispatcher.dispatchDue(this.batchSize);

    const failed = outcomes.filter((o) => o.status === 'failed');
    if (failed.length) {
      this.logger.warn(
        `${failed.length} outbox event(s) failed: ${failed
          .map((o) => `${o.eventType}#${o.eventId}`)
          .join(', ')}`,
      );
    }

    return outcomes.length;
  }

  private async worker(workerId: string): Promise<void> {
    while (this.running) {
      // Clear any coalesced token before waiting, so a stale wakeup cannot
      // make every subsequent iteration spin without real work behind it.
      this.channel.reader.tryRead();

      const proceed = await this.waitForWork();
      if (!proceed) {
        break;
      }

      await this.drain(workerId);
    }
  }

  /**
   * Drains the backlog. Loops immediately while batches come back full (there
   * is probably more waiting), and returns to the wakeup wait once a batch is
   * not full.
   */
  private async drain(workerId: string): Promise<void> {
    while (this.running) {
      let processed = 0;
      try {
        processed = await this.runOnce();
      } catch (error) {
        // Includes losing the database. Log and return to the wait — the next
        // wakeup or poll retries, and rows stay claimable either way.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[OutboxWorker:${workerId}] drain failed: ${message}`,
        );
        return;
      }

      if (processed < this.batchSize) {
        return;
      }
    }
  }

  /**
   * Waits until either the wakeup channel has a token (a producer committed)
   * or the poll-fallback timeout elapses (lost wakeup, or a row's backoff
   * expired while nothing new enqueued).
   *
   * Resolves `false` only when the channel is completed during shutdown.
   */
  private waitForWork(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(true);
        }
      }, this.pollIntervalMs);
      timeout.unref?.();

      void this.channel.reader.waitToReadAsync().then((available) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(available);
        }
      });
    });
  }
}
