import { Effect } from 'effect';
import { DbClientTag, runInTransaction } from '../../db/db.provider';
import type { paymentTransactionStatusEnum } from '../entity/payment-transaction';
import { PaymentGatewayRegistryTag } from '../providers/payment-gateway-registry.provider';
import type { ProcessProviderEventJobData } from '../queue/payment-queue.types';
import { PaymentGatewayCallError, PaymentPersistenceError } from './errors';
import type { PaymentProcessingError } from './errors';
import { findPaymentProviderEvent } from './find-payment-provider-event.use-case';
import { settlePaymentProviderEvent } from './settle-payment-provider-event.use-case';
import { findPaymentAttempt } from './find-payment-attempt.use-case';
import { checkPayment } from './check-payment.use-case';
import { updatePaymentAttempt } from './update-payment-attempt.use-case';
import { upsertPaymentTransactionDetail } from './upsert-payment-transaction-detail.use-case';
import { recordPaymentStatusHistory } from './record-payment-status-history.use-case';
import { upsertPayment } from './upsert-payment.use-case';

export type ProcessProviderEventOutcome =
  | 'skipped'
  | 'ignored_uncorrelated'
  | 'ignored_already_settled'
  | 'ignored_unconfirmed'
  | 'gateway_not_registered'
  | 'succeeded'
  | 'failed'
  | 'pending';

type TransactionStatus =
  (typeof paymentTransactionStatusEnum.enumValues)[number];

function nextTransactionStatus(
  attemptOutcome: 'pending' | 'succeeded' | 'failed',
): TransactionStatus {
  if (attemptOutcome === 'pending') return 'processing';
  return attemptOutcome;
}

/**
 * Applies a received payment_provider_event to the attempt/transaction it
 * correlates to. Trust here is deliberately layered: the event row is
 * whatever a `@Public()` webhook route received, so before acting on it the
 * gateway is asked directly what it currently knows
 * (`PaymentGatewayProvider.reconcile()`) — this is the mitigation for a
 * provider (like ABA PayWay) whose documented webhook carries no
 * signature. A gateway with no `reconcile()` falls back to trusting the
 * re-parsed payload directly.
 */
export const processProviderEvent = Effect.fn('processProviderEvent')(
  function* (
    input: ProcessProviderEventJobData,
  ): Effect.fn.Return<
    ProcessProviderEventOutcome,
    PaymentProcessingError,
    DbClientTag | PaymentGatewayRegistryTag
  > {
    const event = yield* findPaymentProviderEvent(input.paymentProviderEventId);
    if (event.status !== 'received') {
      return 'skipped';
    }

    if (!event.paymentAttemptId) {
      yield* settlePaymentProviderEvent({ id: event.id, status: 'ignored' });
      return 'ignored_uncorrelated';
    }

    const attempt = yield* findPaymentAttempt(event.paymentAttemptId);
    const transaction = yield* checkPayment(attempt.paymentTransactionId);

    if (attempt.status !== 'pending') {
      // Already resolved by a prior attempt-processing run or an earlier
      // event — a later delivery for the same attempt is a duplicate.
      yield* settlePaymentProviderEvent({ id: event.id, status: 'ignored' });
      return 'ignored_already_settled';
    }

    const registry = yield* PaymentGatewayRegistryTag;
    let provider: ReturnType<typeof registry.resolve> | undefined;
    try {
      provider = registry.resolve(event.provider);
    } catch {
      provider = undefined;
    }

    if (!provider) {
      yield* settlePaymentProviderEvent({ id: event.id, status: 'failed' });
      return 'gateway_not_registered';
    }

    // Re-derive the reported status from the stored raw payload — the same
    // parser intake used, so this is deterministic and idempotent.
    const parsed = provider.parseWebhookEvent(
      JSON.stringify(event.payload),
      {},
    );
    const reconcileRef = parsed.providerAttemptId ?? attempt.providerAttemptId;

    let outcome: 'pending' | 'succeeded' | 'failed' =
      parsed.status === 'unknown' ? 'pending' : parsed.status;
    let rawResponse: unknown = event.payload;

    if (provider.reconcile && reconcileRef) {
      const reconciled = yield* Effect.tryPromise({
        try: () => provider.reconcile!(reconcileRef),
        catch: (cause) => new PaymentGatewayCallError({ cause }),
      });
      // The freshly-pulled reconcile result is authoritative — it overrides
      // whatever the (unsigned) webhook payload itself claimed.
      outcome = reconciled.status;
      rawResponse = reconciled.rawResponse ?? rawResponse;
    }

    if (outcome === 'pending') {
      // Could not be corroborated as a definite outcome yet — do not act on
      // an unconfirmed status change, but the event is not lost: leave it
      // out of "processed" so an operator can see it, without retrying the
      // BullMQ job forever (a future delivery/reconcile call is what
      // resolves this, not blind resubmission of the same payload).
      yield* settlePaymentProviderEvent({ id: event.id, status: 'ignored' });
      return 'ignored_unconfirmed';
    }

    const redactedRaw = provider.redact(rawResponse);
    const toStatus = nextTransactionStatus(outcome);

    yield* runInTransaction(
      Effect.gen(function* () {
        yield* upsertPaymentTransactionDetail({
          paymentTransactionId: transaction.id,
          provider: event.provider,
          rawResponse: redactedRaw,
        });
        yield* updatePaymentAttempt({
          id: attempt.id,
          status: outcome,
          failureCode: parsed.failureCode,
          failureMessage: parsed.failureMessage,
        });
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
          reason: 'payment_provider_event',
        });
        yield* settlePaymentProviderEvent({
          id: event.id,
          status: 'processed',
        });
      }),
      (cause) => new PaymentPersistenceError({ cause }),
    );

    return outcome;
  },
);
