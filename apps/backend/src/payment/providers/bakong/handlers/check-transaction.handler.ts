import { Effect } from 'effect';
import type { ApiClient, ApiClientError } from '../../../../utils/api-client';
import type {
  CheckTransactionByMd5Request,
  CheckTransactionByMd5Response,
} from '../bakong.types';

const CHECK_TRANSACTION_PATH = 'v1/check_transaction_by_md5';

/**
 * The only real network call this provider makes — Bakong pushes no
 * webhooks, so `BakongProvider.reconcile()` (which calls this) is the
 * primary way to learn a payment's outcome, not a fallback like ABA's.
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
