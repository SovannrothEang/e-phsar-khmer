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
  /** Who caused the transition. Defaults to `system` (the processor). */
  actorType?: 'system' | 'admin' | 'webhook';
  /** Required in practice when `actorType` is `admin`. */
  actorId?: string;
}

type RecordPaymentStatusHistoryError = PaymentPersistenceError;

/**
 * Appends one business-state transition row. `actorType` defaults to
 * `system` (the processor); an admin override passes `admin` plus its
 * `actorId` so the trail names who moved the status.
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
          actorType: input.actorType ?? 'system',
          actorId: input.actorId ?? null,
          reason: input.reason ?? null,
        })
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  const [row] = rows;
  return row;
});
