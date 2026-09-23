import { Effect } from 'effect';
import { DbClientTag, runInTransaction } from '../../../../db/db.provider';
import type { OutboxService } from '../../../../outbox/outbox.service';
import type { paymentTransactionStatusEnum } from '../../../entity';
import { PaymentGatewayRegistryTag } from '../../../providers/payment-gateway-registry.provider';
import type { PollAttemptJobData } from '../../../queue/payment-queue.types';
import { PaymentGatewayCallError, PaymentPersistenceError } from '../errors';
import type { PaymentProcessingError } from '../errors';
import { enqueuePaymentAttemptPoll } from '../attempt/enqueue-payment-attempt-poll.use-case';
import { failPaymentAttempt } from './fail-payment-attempt.use-case';
import { findPaymentAttempt } from '../attempt/find-payment-attempt.use-case';
import { checkPayment } from '../transaction/check-payment.use-case';
import { updatePaymentAttempt } from '../attempt/update-payment-attempt.use-case';
import { upsertPaymentTransactionDetail } from '../transaction/upsert-payment-transaction-detail.use-case';
import { recordPaymentStatusHistory } from '../transaction/record-payment-status-history.use-case';
import { upsertPayment } from '../transaction/upsert-payment.use-case';
import { postPaymentSettlementLedger } from '../../ledgers';
import { enqueuePaymentSettledEvent } from './enqueue-payment-settled-event.use-case';

export type PollPaymentAttemptOutcome =
  | 'skipped'
  | 'no_reconcile'
  | 'gateway_not_registered'
  | 'gateway_not_configured'
  | 'expired'
  | 'still_pending'
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
 * The other half of a `ChargeResult.poll` request — the loop body for a
 * provider with no webhook at all (see `../providers/bakong/README.md`).
 * Calls `reconcile()` repeatedly instead of `charge()` once; on `pending`
 * it re-enqueues itself via `enqueuePaymentAttemptPoll` rather than
 * terminating. Redelivered jobs for an already-resolved attempt no-op.
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

  // Outside any DB transaction — an HTTP call shouldn't hold locks open.
  const result = yield* Effect.tryPromise({
    try: () => provider.reconcile!(attempt.providerAttemptId!),
    catch: (cause) => new PaymentGatewayCallError({ cause }),
  });

  if (result.status === 'pending') {
    // No DB write on this branch, so nothing for the outbox insert to be
    // atomic with — see enqueuePaymentAttemptPoll's own doc comment.
    yield* enqueuePaymentAttemptPoll(outbox, input);
    return 'still_pending';
  }

  const redactedRaw = provider.redact(result.rawResponse);
  const toStatus = nextTransactionStatus(result.status);
  const now = new Date();

  yield* runInTransaction(
    Effect.gen(function* () {
      yield* upsertPaymentTransactionDetail({
        paymentTransactionId: transaction.id,
        provider: attempt.provider,
        providerTransactionId: result.providerTransactionId,
        rawResponse: redactedRaw,
      });
      yield* updatePaymentAttempt({
        id: attempt.id,
        status: result.status,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
      });
      yield* upsertPayment({
        id: transaction.id,
        expectedVersion: transaction.version,
        status: toStatus,
        completedAt: toStatus === 'succeeded' ? now : undefined,
      });
      yield* recordPaymentStatusHistory({
        paymentTransactionId: transaction.id,
        fromStatus: transaction.status,
        toStatus,
        reason: 'poll',
      });
      if (toStatus === 'succeeded') {
        const ledgerTransaction = yield* postPaymentSettlementLedger(
          transaction,
          now,
        );
        if (ledgerTransaction) {
          yield* enqueuePaymentSettledEvent(
            outbox,
            transaction,
            ledgerTransaction,
          );
        }
      }
    }),
    (cause) => new PaymentPersistenceError({ cause }),
  );

  return result.status;
});
