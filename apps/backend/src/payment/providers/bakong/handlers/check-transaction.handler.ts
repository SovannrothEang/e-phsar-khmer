import { Effect } from 'effect';
import type { ApiClient, ApiClientError } from '../../../../utils/api-client';
import type {
  CheckTransactionByMd5Request,
  CheckTransactionByMd5Response,
} from '../bakong.types';

const CHECK_TRANSACTION_PATH = 'v1/check_transaction_by_md5';

/**
 * The check-transaction action for Bakong — the only real network call this
 * provider makes. Bakong pushes no webhooks for KHQR payments, so this is
 * also the *only* way to learn a payment's outcome; `BakongProvider.reconcile()`
 * is primary here, unlike ABA where reconcile() is a fallback behind a
 * signed webhook.
 *
 * `apiClient` arrives as a plain parameter rather than a `yield*`-ed service
 * tag — same convention as `enqueuePaymentAttempt` taking `OutboxService` as
 * a closure value (see its doc comment): this handler has exactly one
 * caller (`BakongProvider`), so a `Context.Tag` would only add ceremony.
 */
export const checkBakongTransaction = Effect.fn('checkBakongTransaction')(
  function* (
    apiClient: ApiClient,
    md5: string,
  ): Effect.fn.Return<CheckTransactionByMd5Response, ApiClientError, never> {
    const body: CheckTransactionByMd5Request = { md5 };
    return yield* apiClient.post<CheckTransactionByMd5Response>(
      CHECK_TRANSACTION_PATH,
      body,
    );
  },
);
