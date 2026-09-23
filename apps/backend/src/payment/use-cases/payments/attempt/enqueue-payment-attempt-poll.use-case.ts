import { Effect } from 'effect';
import { DbClientTag } from '../../../../db/db.provider';
import type { OutboxService } from '../../../../outbox/outbox.service';
import { PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE } from '../../../outbox/payment-outbox-events';
import type { PollAttemptJobData } from '../../../queue/payment-queue.types';
import { PaymentQueueError } from '../errors';

type EnqueuePaymentAttemptPollError = PaymentQueueError;

/**
 * Durably schedules one round of "ask Bakong again" — same DB→BullMQ
 * handoff shape as the initial charge, for a provider with no webhook (see
 * `../providers/bakong/README.md`). Not required to run inside
 * `runInTransaction` (the "still pending" branch that calls this has no
 * other write to be atomic with) but works fine there too, for the call
 * site scheduling the first round. No `dedupeKey` — see
 * `PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE`'s own doc comment.
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
