import { Effect } from 'effect';
import { DbClientTag } from '../../db/db.provider';
import type { OutboxService } from '../../outbox/outbox.service';
import { PAYMENT_ATTEMPT_OUTBOX_EVENT_TYPE } from '../outbox/payment-outbox-events';
import type { ProcessAttemptJobData } from '../queue/payment-queue.types';
import { PaymentQueueError } from './errors';

type EnqueuePaymentAttemptError = PaymentQueueError;

/**
 * Durably hands a payment_attempt off for processing. Writes an
 * `outbox_events` row rather than calling BullMQ directly — this must run
 * *inside* the same DB transaction as the attempt's own insert (i.e. inside
 * `runInTransaction`, so the ambient `DbClientTag` resolves to that open
 * transaction), which is what makes the handoff durable: the outbox row and
 * the attempt commit together or not at all.
 *
 * `outbox` is a plain parameter, not an Effect requirement: `runInTransaction`
 * re-runs its inner effect with *only* `DbClientTag` provided (see
 * `../../db/db.provider.ts`'s `withTransaction`), so anything this needs
 * beyond the transaction executor has to arrive as an ordinary closure value
 * from the caller, not via `yield*` on another service tag.
 *
 * A `PaymentAttemptOutboxHandler` (`../outbox/payment-attempt-outbox-handler.ts`)
 * is what actually calls `queue.add()` once this row is claimed.
 */
export const enqueuePaymentAttempt = Effect.fn('enqueuePaymentAttempt')(
  function* (
    outbox: OutboxService,
    input: ProcessAttemptJobData,
  ): Effect.fn.Return<void, EnqueuePaymentAttemptError, DbClientTag> {
    const db = yield* DbClientTag;
    yield* Effect.tryPromise({
      try: () =>
        outbox.enqueue(db, {
          eventType: PAYMENT_ATTEMPT_OUTBOX_EVENT_TYPE,
          aggregateType: 'payment_attempt',
          aggregateId: input.paymentAttemptId,
          payload: input,
          dedupeKey: `payment-attempt-requested:${input.paymentAttemptId}`,
        }),
      catch: (cause) => new PaymentQueueError({ cause }),
    });
  },
);
