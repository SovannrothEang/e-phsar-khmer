import { Effect } from 'effect';
import type { ApiClient, ApiClientError } from '../../../../utils/api-client';
import type {
  CreatePurchaseRequest,
  CreatePurchaseResponse,
} from '../aba-payway.types';

const PURCHASE_PATH = 'api/payment-gateway/v1/payments/purchase';

/**
 * The network call behind `AbaPaywayProvider.charge()`. Returns ABA's
 * response as-is — interpreting `status.code` into a `ChargeResult` is the
 * provider's job, not this handler's.
 */
export const createAbaPaywayTransaction = Effect.fn(
  'createAbaPaywayTransaction',
)(function* (
  apiClient: ApiClient,
  request: CreatePurchaseRequest,
): Effect.fn.Return<CreatePurchaseResponse, ApiClientError, never> {
  return yield* apiClient.post<CreatePurchaseResponse>(PURCHASE_PATH, request);
});
