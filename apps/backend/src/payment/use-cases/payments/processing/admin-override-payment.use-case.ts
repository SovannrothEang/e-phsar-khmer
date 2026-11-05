import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag, runInTransaction } from '../../../../db/db.provider';
import type { OutboxService } from '../../../../outbox/outbox.service';
import {
  paymentTransactions,
  paymentTransactionStatusEnum,
  type PaymentTransactionRow,
} from '../../../entity';
import {
  PaymentPersistenceError,
  PaymentTransactionNotFoundError,
} from '../errors';
import type { PaymentUseCaseError } from '../errors';
import { postPaymentSettlementLedger } from '../../ledgers';
import type { LedgerImbalanceError } from '../../ledgers';
import { recordPaymentStatusHistory } from '../transaction/record-payment-status-history.use-case';
import { upsertPayment } from '../transaction/upsert-payment.use-case';
import { enqueuePaymentSettledEvent } from './enqueue-payment-settled-event.use-case';

type TransactionStatus =
  (typeof paymentTransactionStatusEnum.enumValues)[number];

export interface AdminOverridePaymentInput {
  id: string;
  expectedVersion: number;
  /** Omitted when only the description changes — then there is no transition to audit. */
  status?: TransactionStatus;
  description?: string;
  /** Who made the override — recorded on the audit row, never inferred. */
  actorId: string;
  reason?: string;
}

/**
 * A `super_admin` manually moving a payment transaction's status.
 *
 * This is the one status change that has no provider evidence behind it, so it
 * is also the one that must leave a trail: every call writes a
 * `payment_status_history` row with `actorType: 'admin'` and the actor's id.
 * When the override marks the payment `succeeded`, the settlement ledger and
 * the `payment.succeeded` announcement are posted too — otherwise the payment
 * would be recognized in the business tables with no corresponding ledger
 * entry, which is exactly the inconsistency this path used to create.
 *
 * Safe to repeat: `upsertPayment` is version-guarded (a stale version is a
 * conflict, not a silent overwrite) and the ledger post is keyed on the
 * transaction id.
 */
export const adminOverridePayment = Effect.fn('adminOverridePayment')(
  function* (
    outbox: OutboxService,
    input: AdminOverridePaymentInput,
  ): Effect.fn.Return<
    PaymentTransactionRow,
    PaymentUseCaseError | LedgerImbalanceError,
    DbClientTag
  > {
    const db = yield* DbClientTag;
    const now = new Date();

    return yield* runInTransaction(
      Effect.gen(function* () {
        const existing = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(paymentTransactions)
              .where(eq(paymentTransactions.id, input.id)),
          catch: (cause) => new PaymentPersistenceError({ cause }),
        });
        const current = existing[0];
        if (!current) {
          return yield* new PaymentTransactionNotFoundError({ id: input.id });
        }

        const updated = yield* upsertPayment({
          id: input.id,
          expectedVersion: input.expectedVersion,
          status: input.status,
          description: input.description,
          completedAt:
            input.status === 'succeeded'
              ? now
              : input.status
                ? // Moving away from `succeeded` must not leave a completion
                  // timestamp behind.
                  null
                : undefined,
        });

        if (input.status !== undefined) {
          yield* recordPaymentStatusHistory({
            paymentTransactionId: input.id,
            fromStatus: current.status,
            toStatus: input.status,
            actorType: 'admin',
            actorId: input.actorId,
            reason: input.reason ?? input.description,
          });
        }

        // Idempotent on the transaction id, so this also heals a payment that
        // reached `succeeded` before the ledger existed.
        if (input.status === 'succeeded') {
          const ledgerTransaction = yield* postPaymentSettlementLedger(
            updated,
            now,
          );
          // The settled event's dedupe key is an outbox row that retention
          // deletes after 7 days, so re-announcing an old settlement would
          // notify the customer a second time. Announce only on the
          // transition; the ledger post above stays unconditional.
          if (ledgerTransaction && current.status !== 'succeeded') {
            yield* enqueuePaymentSettledEvent(
              outbox,
              updated,
              ledgerTransaction,
            );
          }
        }

        return updated;
      }),
      (cause) => new PaymentPersistenceError({ cause }),
    );
  },
);
