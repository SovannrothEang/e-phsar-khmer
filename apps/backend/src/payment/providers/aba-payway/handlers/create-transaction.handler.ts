import { Effect } from 'effect';
import type { ApiClient, ApiClientError } from '../../../../utils/api-client';
import type {
  CreatePurchaseRequest,
  CreatePurchaseResponse,
} from '../aba-payway.types';

const PURCHASE_PATH = 'api/payment-gateway/v1/payments/purchase';

/**
 * The create-transaction action for ABA PayWay — the network call behind
 * `AbaPaywayProvider.charge()`. `apiClient` arrives as a plain parameter
 * rather than a `yield*`-ed service tag, same convention as Bakong's
 * handlers (see `../../bakong/handlers/check-transaction.handler.ts`): this
 * has exactly one caller.
 *
 * Returns ABA's response as-is — interpreting `status.code` (transport-level
 * success) into a `ChargeResult` is the provider's job, not this handler's,
 * same division of labor `checkAbaPaywayTransaction` uses.
 */
export const createAbaPaywayTransaction = Effect.fn(
  'createAbaPaywayTransaction',
)(function* (
  apiClient: ApiClient,
  request: CreatePurchaseRequest,
): Effect.fn.Return<CreatePurchaseResponse, ApiClientError, never> {
  return yield* apiClient.post<CreatePurchaseResponse>(PURCHASE_PATH, request);
});
