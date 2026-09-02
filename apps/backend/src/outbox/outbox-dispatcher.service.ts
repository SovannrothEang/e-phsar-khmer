import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OutboxEventRow } from '../db/schema/outbox.schema';
import { computeBackoffMs } from './backoff.util';
import { OutboxRegistry } from './outbox-registry.service';
import { OutboxService } from './outbox.service';
import type { DispatchOutcome, HandlerOutcome } from './outbox.types';

/**
 * Runs claimed events through their handler and writes the result back.
 *
 * Both dispatch paths — the background worker and a producer's inline
 * fast-path — go through here, and both start by *claiming*. That is what
 * makes the two safe to run against the same event: the claim is a
 * conditional UPDATE, so exactly one of them wins and the loser gets
 * nothing back to work on.
 */
@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly registry: OutboxRegistry,
    private readonly configService: ConfigService,
  ) {}

  /** Claims and dispatches everything currently due, oldest first. */
  async dispatchDue(limit: number): Promise<DispatchOutcome[]> {
    const claimed = await this.outbox.claimDue(limit);
    const outcomes: DispatchOutcome[] = [];

    // Sequential on purpose: a batch usually targets one provider, and
    // firing the whole batch at it concurrently is how you get rate-limited.
    for (const event of claimed) {
      outcomes.push(await this.run(event));
    }

    return outcomes;
  }

  /**
   * Attempts one specific event immediately. Returns `null` when the event
   * could not be claimed — a worker already has it, and the caller should
   * treat it as in flight rather than retrying.
   */
  async dispatchById(eventId: string): Promise<DispatchOutcome | null> {
    const event = await this.outbox.claimById(eventId);
    return event ? this.run(event) : null;
  }

  private async run(event: OutboxEventRow): Promise<DispatchOutcome> {
    const handler = this.registry.get(event.eventType);

    // An unregistered type is treated as retryable rather than fatal: during
    // a rolling deploy the producer can be live before its consumer is, and
    // failing those events outright would discard them. Exhausting the
    // retry budget still ends in `failed`, so a genuinely missing handler
    // surfaces — it just doesn't lose data on the way there.
    if (!handler) {
      return this.settle(event, {
        status: 'retry',
        error: `No handler registered for ${event.eventType}`,
      });
    }

    let outcome: HandlerOutcome;
    try {
      outcome = await handler.handle(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Handler for ${event.eventType} threw on event ${event.id}: ${message}`,
      );
      outcome = { status: 'retry', error: message };
    }

    return this.settle(event, outcome);
  }

  private async settle(
    event: OutboxEventRow,
    outcome: HandlerOutcome,
  ): Promise<DispatchOutcome> {
    const handler = this.registry.get(event.eventType);
    const redacted = handler?.redact?.(event.payload);
    const base = { eventId: event.id, eventType: event.eventType };

    if (outcome.status === 'published') {
      await this.outbox.markPublished(event.id, redacted);
      return { ...base, status: 'published' };
    }

    if (outcome.status === 'failed') {
      await this.outbox.markFailed(event.id, outcome.error, redacted);
      return { ...base, status: 'failed', error: outcome.error };
    }

    // A retry the budget can no longer fund. The handler asked to try again,
    // so it doesn't know this is the end — tell it, or the aggregate that
    // produced the event stays in its in-flight state forever.
    if (event.attempts >= event.maxAttempts) {
      await this.outbox.markFailed(event.id, outcome.error, redacted);
      await this.abandon(event, outcome.error);
      this.logger.warn(
        `Event ${event.id} (${event.eventType}) abandoned after ${event.attempts} attempts: ${outcome.error}`,
      );
      return { ...base, status: 'failed', error: outcome.error };
    }

    const delayMs = computeBackoffMs(event.attempts, {
      baseMs: this.configService.get<number>('outbox.backoffBaseMs') ?? 1000,
      factor: this.configService.get<number>('outbox.backoffFactor') ?? 5,
      maxMs: this.configService.get<number>('outbox.backoffMaxMs') ?? 900_000,
    });

    await this.outbox.markRetry(event.id, outcome.error, delayMs);
    return { ...base, status: 'retry', error: outcome.error };
  }

  private async abandon(
    event: OutboxEventRow,
    lastError: string,
  ): Promise<void> {
    const handler = this.registry.get(event.eventType);
    if (!handler?.onAbandoned) {
      return;
    }

    try {
      await handler.onAbandoned(event, lastError);
    } catch (err) {
      // The event is already terminal; a failing cleanup hook must not
      // resurrect it or take down the worker loop.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `onAbandoned for ${event.eventType} threw on event ${event.id}: ${message}`,
      );
    }
  }
}
