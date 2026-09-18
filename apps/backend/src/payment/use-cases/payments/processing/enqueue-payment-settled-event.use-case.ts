import { Effect } from 'effect';
import { DbClientTag } from '../../../../db/db.provider';
import type { OutboxService } from '../../../../outbox/outbox.service';
import { PAYMENT_SETTLED_OUTBOX_EVENT_TYPE } from '../../../outbox/payment-outbox-events';
import type {
  LedgerTransactionRow,
  PaymentTransactionRow,
} from '../../../entity';
import { PaymentQueueError } from '../errors';

type EnqueuePaymentSettledEventError = PaymentQueueError;

export interface PaymentSettledEventPayload {
  paymentTransactionId: string;
  ledgerTransactionId: string;
  tenantId: string;
  orderId: string | null;
  customerId: string | null;
  amount: string;
  currency: string;
  occurredAt: string;
}

/**
 * Announces a settled payment to the rest of the system — the
 * business-level companion to `enqueuePaymentAttempt`/
 * `enqueuePaymentProviderEvent`'s internal DB→BullMQ plumbing, not a
 * replacement for it (see `PAYMENT_SETTLED_OUTBOX_EVENT_TYPE`'s own doc
 * comment). Nothing in this module subscribes to this event yet — it
 * exists for other modules (notifications, orders) to pick up later.
 *
 * Callers must invoke this only when `postPaymentSettlementLedger` actually
 * produced a `ledgerTransaction` (i.e. inside the same `if (toStatus ===
 * 'succeeded')` branch, after the ledger posting), and inside the same
 * `runInTransaction` block — same durability contract as every other
 * outbox write in this module: a crash between the ledger posting and this
 * announcement can never happen, because they commit together or not at
 * all.
 *
 * `dedupeKey` mirrors `ledger_transactions.idempotencyKey` (both keyed on
 * the payment_transaction id), so a redelivered job that reaches settlement
 * twice — already prevented from double-posting the ledger by that same
 * key — can never double-write this event either.
 */
export const enqueuePaymentSettledEvent = Effect.fn(
  'enqueuePaymentSettledEvent',
)(function* (
  outbox: OutboxService,
  transaction: PaymentTransactionRow,
  ledgerTransaction: LedgerTransactionRow,
): Effect.fn.Return<void, EnqueuePaymentSettledEventError, DbClientTag> {
  const db = yield* DbClientTag;
  const payload: PaymentSettledEventPayload = {
    paymentTransactionId: transaction.id,
    ledgerTransactionId: ledgerTransaction.id,
    tenantId: transaction.tenantId,
    orderId: transaction.orderId,
    customerId: transaction.customerId,
    amount: transaction.amount,
    currency: transaction.currency,
    occurredAt: ledgerTransaction.occurredAt.toISOString(),
  };
  yield* Effect.tryPromise({
    try: () =>
      outbox.enqueue(db, {
        eventType: PAYMENT_SETTLED_OUTBOX_EVENT_TYPE,
        aggregateType: 'payment_transaction',
        aggregateId: transaction.id,
        payload,
        dedupeKey: `payment-succeeded:${transaction.id}`,
      }),
    catch: (cause) => new PaymentQueueError({ cause }),
  });
});
