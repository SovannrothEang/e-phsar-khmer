import { Effect } from 'effect';
import {
  paymentStatusHistory,
  paymentTransactionStatusEnum,
  type PaymentStatusHistoryRow,
} from '../../../entity';
import { DbClientTag } from '../../../../db/db.provider';
import { PaymentPersistenceError } from '../errors';

export interface RecordPaymentStatusHistoryInput {
  paymentTransactionId: string;
  fromStatus?: (typeof paymentTransactionStatusEnum.enumValues)[number];
  toStatus: (typeof paymentTransactionStatusEnum.enumValues)[number];
  reason?: string;
}

type RecordPaymentStatusHistoryError = PaymentPersistenceError;

/**
 * Appends one business-state transition row. Always `actorType: 'system'`
 * here — the processor is the only caller, and an admin-initiated
 * transition goes through `PaymentsController.update()` instead.
 */
export const recordPaymentStatusHistory = Effect.fn(
  'recordPaymentStatusHistory',
)(function* (
  input: RecordPaymentStatusHistoryInput,
): Effect.fn.Return<
  PaymentStatusHistoryRow,
  RecordPaymentStatusHistoryError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(paymentStatusHistory)
        .values({
          paymentTransactionId: input.paymentTransactionId,
          fromStatus: input.fromStatus ?? null,
          toStatus: input.toStatus,
          actorType: 'system',
          reason: input.reason ?? null,
        })
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  const [row] = rows;
  return row;
});
