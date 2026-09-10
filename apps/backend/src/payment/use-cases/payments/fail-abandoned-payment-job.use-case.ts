import { Effect } from 'effect';
import { DbClientTag, runInTransaction } from '../../../db/db.provider';
import { PaymentPersistenceError } from './errors';
import type { PaymentProcessingError } from './errors';
import { checkPayment } from './check-payment.use-case';
import { failPaymentAttempt } from './fail-payment-attempt.use-case';
import { findPaymentAttempt } from './find-payment-attempt.use-case';

export interface FailAbandonedPaymentJobInput {
  paymentAttemptId: string;
  paymentTransactionId: string;
  failureCode: string;
  failureMessage: string;
}

export type FailAbandonedPaymentJobOutcome = 'failed' | 'skipped';

/**
 * The safety net for a `process-attempt`/`poll-attempt` BullMQ job that
 * exhausted its retries — called from `PaymentProcessor`'s `'failed'`
 * worker-event listener, never from the job-processing path itself (see
 * that listener's own doc comment for why: a job's own retries are meant to
 * cover *transient* failures, this covers "retries ran out and we're
 * giving up").
 *
 * Without this, an attempt whose gateway call keeps throwing (bad
 * credentials, gateway outage, ...) sits at `pending` — and its
 * transaction at `processing` — forever, indistinguishable from a payer
 * who just hasn't paid yet. `failureMessage` carries the underlying error
 * so this is actually debuggable from `payment_attempts.failure_message`
 * instead of only ever existing in a BullMQ job's (eventually evicted)
 * failure log.
 *
 * `skipped` when the attempt already left `pending` some other way (a poll
 * round that resolved it after this job was queued but before the listener
 * ran, for instance) — never clobber a real outcome with a stale failure.
 */
export const failAbandonedPaymentJob = Effect.fn('failAbandonedPaymentJob')(
  function* (
    input: FailAbandonedPaymentJobInput,
  ): Effect.fn.Return<
    FailAbandonedPaymentJobOutcome,
    PaymentProcessingError,
    DbClientTag
  > {
    const attempt = yield* findPaymentAttempt(input.paymentAttemptId);
    if (attempt.status !== 'pending') {
      return 'skipped';
    }

    const transaction = yield* checkPayment(input.paymentTransactionId);

    yield* runInTransaction(
      failPaymentAttempt({
        attempt,
        transaction,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
      }),
      (cause) => new PaymentPersistenceError({ cause }),
    );

    return 'failed';
  },
);
