import type { DbClient } from '../db/drizzle.provider';
import type { OutboxEventRow } from '../db/schema/outbox.schema';

/**
 * Anything that can run a statement — the pooled client or an open
 * transaction. `enqueue()` takes one of these instead of grabbing the
 * global client so a producer can hand it the *same* transaction its
 * domain write is running in. That shared transaction is the entire point
 * of the pattern: the row and its event commit together or not at all.
 */
export type TxClient = Parameters<Parameters<DbClient['transaction']>[0]>[0];
export type DbExecutor = DbClient | TxClient;

/** What a producer hands to `OutboxService.enqueue()`. */
export interface IntegrationEvent<TPayload = Record<string, unknown>> {
  /** Dotted namespace, e.g. `chat.message.sent`. */
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  /**
   * Producer-side idempotency key. Two enqueues with the same key collapse
   * into one event; omit it and every call produces a distinct event.
   */
  dedupeKey?: string;
  /** Overrides the module default for this event only. */
  maxAttempts?: number;
}

/**
 * What a handler reports back. `retry` and `failed` are a deliberate
 * distinction the handler owns, not something the dispatcher infers: only
 * the handler knows whether a provider said "try later" or "never".
 */
export type HandlerOutcome =
  | { status: 'published' }
  | { status: 'retry'; error: string }
  | { status: 'failed'; error: string };

export interface OutboxHandler {
  readonly eventType: string;

  handle(event: OutboxEventRow): Promise<HandlerOutcome>;

  /**
   * Called when the dispatcher gives up on an event the handler had asked
   * to retry. Without this the producing aggregate would sit in its
   * in-flight state forever, since a retry budget runs out in the outbox,
   * not in the handler.
   */
  onAbandoned?(event: OutboxEventRow, lastError: string): Promise<void>;

  /**
   * Strips secrets from the payload once the event reaches a terminal
   * state. An event carrying a one-time code has to hold it in plaintext
   * until it is delivered; this is what stops that outliving the delivery.
   */
  redact?(payload: unknown): unknown;
}

export type DispatchStatus = 'published' | 'retry' | 'failed';

export interface DispatchOutcome {
  eventId: string;
  eventType: string;
  status: DispatchStatus;
  error?: string;
}
