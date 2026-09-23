import { Effect } from 'effect';
import { DbClientTag, runInTransaction } from '../../../../db/db.provider';
import { PaymentPersistenceError } from '../errors';
import type { PaymentProcessingError } from '../errors';
import { checkPayment } from '../transaction/check-payment.use-case';
import { failPaymentAttempt } from './fail-payment-attempt.use-case';
import { findPaymentAttempt } from '../attempt/find-payment-attempt.use-case';

export interface FailAbandonedPaymentJobInput {
  paymentAttemptId: string;
  paymentTransactionId: string;
  failureCode: string;
  failureMessage: string;
}

export type FailAbandonedPaymentJobOutcome = 'failed' | 'skipped';

/**
 * Safety net for a `process-attempt`/`poll-attempt` BullMQ job that
 * exhausted its retries — called from `PaymentProcessor`'s `'failed'`
 * listener, not the job path itself. Without it, a gateway call that keeps
 * throwing leaves an attempt stuck `pending` forever, indistinguishable
 * from a payer who hasn't paid. `skipped` when the attempt already
 * resolved some other way (e.g. a poll round beat the listener) — never
 * clobber a real outcome with a stale failure.
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
