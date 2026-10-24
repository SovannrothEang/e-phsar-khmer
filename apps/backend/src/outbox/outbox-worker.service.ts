import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxDispatcher } from './outbox-dispatcher.service';
import { OutboxService } from './outbox.service';
import { WakeupSignal } from './wakeup-signal';

const SHUTDOWN_GRACE_MS = 10_000;

/**
 * The background worker: Postgres is the queue, this is the consumer pool.
 *
 * It runs in-process on every API instance. That is safe because claiming
 * is atomic (`FOR UPDATE SKIP LOCKED`), so N instances simply drain the
 * table N times faster — no leader election, no broker. Set
 * `OUTBOX_WORKER_ENABLED=false` to disable this drainer when another
 * deployment is responsible for draining the table.
 *
 * The trigger is event-driven (a producer's `wakeupAfterCommit`), backed by
 * a poll-fallback timer that is independent of the workers — the safety net for a lost wakeup and the
 * steady-state heartbeat that picks up rows whose backoff expired while
 * nothing new enqueued. The pool stays bounded: fixed worker count, coalesced
 * wakeup signal, capped batch — memory is O(workers + batch); the durable backlog
 * lives in `outbox_events`, never in RAM.
 */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly wakeupSignal = new WakeupSignal();
  private readonly workers: Promise<void>[] = [];
  private running = false;
  private fallbackTimer: NodeJS.Timeout | undefined;
  /** Set by the fallback timer, taken by the first worker that wakes. */
  private fallbackDue = false;

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

    // The periodic DB fallback lives outside the workers on purpose: if it
    // belonged to one of them, a handler that hangs that worker would stop the
    // heartbeat for the whole instance. Each tick wakes ONE idle worker (or
    // leaves a token if all are busy), so idle polling cost stays one query per
    // interval regardless of pool concurrency.
    this.fallbackTimer = setInterval(() => {
      this.fallbackDue = true;
      this.wakeupSignal.notifyOne();
    }, this.pollIntervalMs);
    this.fallbackTimer.unref();

    // Startup drain: wake the pool once so any backlog committed before this
    // process booted is claimed without waiting for the poll fallback.
    this.wakeup();
  }

  async onModuleDestroy(): Promise<void> {
    // Stop accepting work: workers finish the batch they are on, then exit.
    this.running = false;
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);

    // Releasing blocked readers is what lets the worker loops observe
    // `running === false` and unwind.
    this.wakeupSignal.close();

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
   * This does NOT perform the dispatch — it tells the local pool to check
   * PostgreSQL. Notifications coalesce while workers are busy.
   */
  wakeup(): void {
    this.wakeupSignal.notify();
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
      const result = await this.wakeupSignal.wait();
      if (result !== 'signaled' || !this.running) break;

      // Take the fallback flag: whichever worker wakes first after a tick is
      // the one that reports a discovered backlog to its peers.
      const fallbackPoll = this.fallbackDue;
      this.fallbackDue = false;

      await this.drain(workerId, fallbackPoll);
    }
  }

  /**
   * Drains the backlog. Loops immediately while batches come back full (there
   * is probably more waiting), and returns to the wakeup wait once a batch is
   * not full.
   */
  private async drain(workerId: string, fallbackPoll: boolean): Promise<void> {
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

      // A fallback poll can discover a backlog even when producers live in a
      // different process. Wake parked peers to restore configured claim
      // concurrency; this worker is busy, so it cannot wake itself.
      if (fallbackPoll && processed > 0) {
        this.wakeupSignal.notifyWaiters();
        fallbackPoll = false;
      }

      if (processed < this.batchSize) {
        return;
      }
    }
  }
}
