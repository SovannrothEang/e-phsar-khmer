import { Effect } from 'effect';
import { DbClientTag, runInTransaction } from '../../db/db.provider';
import type { paymentTransactionStatusEnum } from '../entity/payment-transaction';
import { PaymentGatewayRegistryTag } from '../providers/payment-gateway-registry.provider';
import type { ProcessAttemptJobData } from '../queue/payment-queue.types';
import { PaymentGatewayCallError, PaymentPersistenceError } from './errors';
import type { PaymentProcessingError } from './errors';
import { findPaymentAttempt } from './find-payment-attempt.use-case';
import { checkPayment } from './check-payment.use-case';
import { updatePaymentAttempt } from './update-payment-attempt.use-case';
import { upsertPaymentTransactionDetail } from './upsert-payment-transaction-detail.use-case';
import { recordPaymentStatusHistory } from './record-payment-status-history.use-case';
import { upsertPayment } from './upsert-payment.use-case';

export type ProcessPaymentAttemptOutcome =
  | 'skipped'
  | 'gateway_not_registered'
  | 'pending'
  | 'succeeded'
  | 'failed';

type TransactionStatus =
  (typeof paymentTransactionStatusEnum.enumValues)[number];

function nextTransactionStatus(
  attemptOutcome: 'pending' | 'succeeded' | 'failed',
): TransactionStatus {
  if (attemptOutcome === 'pending') return 'processing';
  return attemptOutcome;
}

/**
 * Turns a committed, `pending` payment_attempt into a provider charge. The
 * only place that calls a gateway for initiation.
 *
 * Written for BullMQ's at-least-once delivery: a redelivered job for an
 * attempt that already resolved is a no-op (step 1). A gateway that isn't
 * registered is a wiring mistake, not a transient fault, and is handled as
 * a normal (non-retried) outcome — it fails the attempt outright rather
 * than yielding a typed error, which would ask the caller to retry
 * something a retry can never fix. A gateway call that produces no answer
 * (network error, timeout) *is* thrown, via `PaymentGatewayCallError` —
 * that's what asks BullMQ's own backoff to try again.
 */
export const processPaymentAttempt = Effect.fn('processPaymentAttempt')(
  function* (
    input: ProcessAttemptJobData,
  ): Effect.fn.Return<
    ProcessPaymentAttemptOutcome,
    PaymentProcessingError,
    DbClientTag | PaymentGatewayRegistryTag
  > {
    const attempt = yield* findPaymentAttempt(input.paymentAttemptId);
    if (attempt.status !== 'pending') {
      return 'skipped';
    }

    const transaction = yield* checkPayment(input.paymentTransactionId);
    const registry = yield* PaymentGatewayRegistryTag;

    // Synchronous and never throws in a way worth an Effect channel for —
    // caught inline and turned into the "not registered" branch below.
    let provider: ReturnType<typeof registry.resolve> | undefined;
    try {
      provider = registry.resolve(attempt.provider);
    } catch {
      provider = undefined;
    }

    if (!provider) {
      yield* runInTransaction(
        Effect.gen(function* () {
          yield* updatePaymentAttempt({
            id: attempt.id,
            status: 'failed',
            failureCode: 'PROVIDER_NOT_REGISTERED',
            failureMessage: `No payment gateway registered for provider "${attempt.provider}"`,
          });
          yield* upsertPayment({
            id: transaction.id,
            expectedVersion: transaction.version,
            status: 'failed',
          });
          yield* recordPaymentStatusHistory({
            paymentTransactionId: transaction.id,
            fromStatus: transaction.status,
            toStatus: 'failed',
            reason: `No payment gateway registered for provider "${attempt.provider}"`,
          });
        }),
        (cause) => new PaymentPersistenceError({ cause }),
      );
      return 'gateway_not_registered';
    }

    // Outside the DB transaction on purpose — an HTTP call to a gateway has
    // no business holding a Postgres transaction (and its locks) open.
    const result = yield* Effect.tryPromise({
      try: () =>
        provider.charge({
          attemptId: attempt.id,
          transactionId: transaction.id,
          reference: transaction.reference,
          amount: attempt.amount,
          currency: attempt.currency,
          method: attempt.method,
          customerId: transaction.customerId ?? undefined,
          description: transaction.description ?? undefined,
          returnUrl: input.browserReturnUrl,
        }),
      catch: (cause) => new PaymentGatewayCallError({ cause }),
    });

    const redactedRaw = provider.redact(result.rawResponse);
    const toStatus = nextTransactionStatus(result.status);

    yield* runInTransaction(
      Effect.gen(function* () {
        yield* upsertPaymentTransactionDetail({
          paymentTransactionId: transaction.id,
          provider: attempt.provider,
          providerTransactionId: result.providerTransactionId,
          paymentMethodType: result.paymentMethodType,
          maskedAccount: result.maskedAccount,
          redirectUrl: result.redirectUrl,
          rawResponse: redactedRaw,
        });
        yield* updatePaymentAttempt({
          id: attempt.id,
          status: result.status,
          providerAttemptId: result.providerAttemptId,
          failureCode: result.failureCode,
          failureMessage: result.failureMessage,
        });

        if (toStatus !== transaction.status) {
          yield* upsertPayment({
            id: transaction.id,
            expectedVersion: transaction.version,
            status: toStatus,
            completedAt: toStatus === 'succeeded' ? new Date() : undefined,
          });
          yield* recordPaymentStatusHistory({
            paymentTransactionId: transaction.id,
            fromStatus: transaction.status,
            toStatus,
          });
        }
      }),
      (cause) => new PaymentPersistenceError({ cause }),
    );

    return result.status;
  },
);
