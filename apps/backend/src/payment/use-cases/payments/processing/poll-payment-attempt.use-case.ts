import { Effect } from 'effect';
import { DbClientTag, runInTransaction } from '../../../../db/db.provider';
import type { OutboxService } from '../../../../outbox/outbox.service';
import { PaymentGatewayRegistryTag } from '../../../providers/payment-gateway-registry.provider';
import type { PollAttemptJobData } from '../../../queue/payment-queue.types';
import { PaymentGatewayCallError, PaymentPersistenceError } from '../errors';
import type { PaymentProcessingError } from '../errors';
import { enqueuePaymentAttemptPoll } from '../attempt/enqueue-payment-attempt-poll.use-case';
import { failPaymentAttempt } from './fail-payment-attempt.use-case';
import { findPaymentAttempt } from '../attempt/find-payment-attempt.use-case';
import { checkPayment } from '../transaction/check-payment.use-case';
import { settleReconciledAttempt } from './settle-reconciled-attempt.use-case';

export type PollPaymentAttemptOutcome =
  | 'skipped'
  | 'no_reconcile'
  | 'gateway_not_registered'
  | 'gateway_not_configured'
  | 'expired'
  | 'still_pending'
  | 'succeeded'
  | 'failed';

/**
 * The other half of a `ChargeResult.poll` request — the loop body for a
 * provider with no webhook at all (see `../providers/bakong/README.md`).
 * Calls `reconcile()` repeatedly instead of `charge()` once; on `pending`
 * it re-enqueues itself via `enqueuePaymentAttemptPoll` rather than
 * terminating. Redelivered jobs for an already-resolved attempt no-op.
 *
 * This chain is the FAST path (quick confirmation while the payer watches),
 * not the guarantee: it is a self-rescheduling chain, so one lost link strands
 * the attempt. The guarantee is `PaymentReconciler`, which settles any
 * unresolved attempt straight from the database with no chain at all.
 */
export const pollPaymentAttempt = Effect.fn('pollPaymentAttempt')(function* (
  outbox: OutboxService,
  input: PollAttemptJobData,
): Effect.fn.Return<
  PollPaymentAttemptOutcome,
  PaymentProcessingError,
  DbClientTag | PaymentGatewayRegistryTag
> {
  const attempt = yield* findPaymentAttempt(input.paymentAttemptId);
  if (attempt.status !== 'pending') {
    return 'skipped';
  }

  const transaction = yield* checkPayment(input.paymentTransactionId);
  const registry = yield* PaymentGatewayRegistryTag;

  let provider: ReturnType<typeof registry.resolve> | undefined;
  try {
    provider = registry.resolve(attempt.provider);
  } catch {
    provider = undefined;
  }

  if (!provider) {
    yield* runInTransaction(
      failPaymentAttempt({
        attempt,
        transaction,
        failureCode: 'PROVIDER_NOT_REGISTERED',
        failureMessage: `No payment gateway registered for provider "${attempt.provider}"`,
      }),
      (cause) => new PaymentPersistenceError({ cause }),
    );
    return 'gateway_not_registered';
  }

  // Missing credentials mid-poll — same give-up treatment as unregistered.
  if (provider.isConfigured && !provider.isConfigured()) {
    yield* runInTransaction(
      failPaymentAttempt({
        attempt,
        transaction,
        failureCode: 'GATEWAY_NOT_CONFIGURED',
        failureMessage: `Payment gateway "${attempt.provider}" is not configured`,
      }),
      (cause) => new PaymentPersistenceError({ cause }),
    );
    return 'gateway_not_configured';
  }

  if (!provider.reconcile || !attempt.providerAttemptId) {
    // Shouldn't happen (ChargeResult.poll implies both) — guarded rather
    // than looping on a job that can never make progress.
    return 'no_reconcile';
  }

  // Outside any DB transaction — an HTTP call shouldn't hold locks open.
  // Asked BEFORE judging expiry: a payer who paid right at the deadline (or
  // whose poll round ran late) must still settle, never be failed on the clock.
  const result = yield* Effect.tryPromise({
    try: () => provider.reconcile!(attempt.providerAttemptId!),
    catch: (cause) => new PaymentGatewayCallError({ cause }),
  });

  if (result.status === 'pending') {
    if (Date.now() >= input.expiresAt) {
      yield* runInTransaction(
        failPaymentAttempt({
          attempt,
          transaction,
          failureCode: 'POLL_EXPIRED',
          failureMessage:
            'Gave up waiting for a payment confirmation before the checkout expired',
        }),
        (cause) => new PaymentPersistenceError({ cause }),
      );
      return 'expired';
    }

    // No DB write on this branch, so nothing for the outbox insert to be
    // atomic with — see enqueuePaymentAttemptPoll's own doc comment.
    yield* enqueuePaymentAttemptPoll(outbox, input);
    return 'still_pending';
  }

  yield* settleReconciledAttempt(outbox, {
    attempt,
    transaction,
    provider,
    result: { ...result, status: result.status },
    reason: 'poll',
  });

  return result.status;
});
