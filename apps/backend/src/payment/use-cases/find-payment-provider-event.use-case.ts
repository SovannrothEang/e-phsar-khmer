import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../db/db.provider';
import {
  paymentProviderEvents,
  type PaymentProviderEventRow,
} from '../entity/payment-provider-event';
import {
  PaymentPersistenceError,
  PaymentProviderEventNotFoundError,
} from './errors';

type FindPaymentProviderEventError =
  | PaymentProviderEventNotFoundError
  | PaymentPersistenceError;

/** Reads a single payment_provider_event by id, or fails if it doesn't exist. */
export const findPaymentProviderEvent = Effect.fn('findPaymentProviderEvent')(
  function* (
    id: string,
  ): Effect.fn.Return<
    PaymentProviderEventRow,
    FindPaymentProviderEventError,
    DbClientTag
  > {
    const db = yield* DbClientTag;
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(paymentProviderEvents)
          .where(eq(paymentProviderEvents.id, id)),
      catch: (cause) => new PaymentPersistenceError({ cause }),
    });

    const [row] = rows;
    if (!row) {
      return yield* new PaymentProviderEventNotFoundError({ id });
    }
    return row;
  },
);
