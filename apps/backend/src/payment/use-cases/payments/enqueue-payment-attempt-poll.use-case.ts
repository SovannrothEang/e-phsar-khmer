import { Effect } from 'effect';
import { DbClientTag } from '../../../db/db.provider';
import type { OutboxService } from '../../../outbox/outbox.service';
import { PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE } from '../../outbox/payment-outbox-events';
import type { PollAttemptJobData } from '../../queue/payment-queue.types';
import { PaymentQueueError } from './errors';

type EnqueuePaymentAttemptPollError = PaymentQueueError;

/**
 * Durably schedules one round of "ask Bakong again" — the same
 * DB-commit-to-BullMQ handoff `enqueuePaymentAttempt` does for the initial
 * charge, reused here for a provider with no webhook (see
 * `../providers/bakong/README.md`).
 *
 * `outbox` arrives as a plain parameter, same convention as
 * `enqueuePaymentAttempt` — see its own doc comment on why (in short:
 * `runInTransaction` only ever puts `DbClientTag` in scope, so anything
 * else has to come in as an ordinary closure value). Unlike that use-case,
 * this one is *not* required to run inside `runInTransaction`: the "still
 * pending, poll again" branch that calls this makes no other DB write to be
 * atomic with (see `poll-payment-attempt.use-case.ts`) — it still works
 * fine inside a transaction too, for the one call site that schedules the
 * *first* round alongside the attempt's own pending-status write.
 *
 * No `dedupeKey` — see `PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE`'s doc
 * comment on why every call here is meant to insert a fresh row.
 */
export const enqueuePaymentAttemptPoll = Effect.fn('enqueuePaymentAttemptPoll')(
  function* (
    outbox: OutboxService,
    input: PollAttemptJobData,
  ): Effect.fn.Return<void, EnqueuePaymentAttemptPollError, DbClientTag> {
    const db = yield* DbClientTag;
    yield* Effect.tryPromise({
      try: () =>
        outbox.enqueue(db, {
          eventType: PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE,
          aggregateType: 'payment_attempt',
          aggregateId: input.paymentAttemptId,
          payload: input,
        }),
      catch: (cause) => new PaymentQueueError({ cause }),
    });
  },
);
