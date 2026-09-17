import { Effect } from 'effect';
import type { ApiClient, ApiClientError } from '../../../../utils/api-client';
import type {
  CheckTransactionRequest,
  CheckTransactionResponse,
} from '../aba-payway.types';

const CHECK_TRANSACTION_PATH =
  'api/payment-gateway/v1/payments/check-transaction-2';

/**
 * The check-transaction action for ABA PayWay — the network call behind
 * `AbaPaywayProvider.reconcile()`. A non-`"00"` `status.code` in the response
 * means ABA has no record of this `tran_id` yet, not a rejection — the
 * provider treats that as inconclusive (`pending`), so this handler just
 * returns the response as-is rather than modeling ok/failed itself.
 */
export const checkAbaPaywayTransaction = Effect.fn('checkAbaPaywayTransaction')(
  function* (
    apiClient: ApiClient,
    request: CheckTransactionRequest,
  ): Effect.fn.Return<CheckTransactionResponse, ApiClientError, never> {
    return yield* apiClient.post<CheckTransactionResponse>(
      CHECK_TRANSACTION_PATH,
      request,
    );
  },
);
