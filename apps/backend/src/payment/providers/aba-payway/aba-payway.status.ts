import type { PaymentAttemptOutcome } from '../payment-gateway.types';

/** ABA PayWay returns "00" on `status.code` when the API call itself succeeded. */
export const ABA_PAYWAY_API_OK = '00';

/** ABA PayWay returns 0 on `payment_status_code` when the payment was approved. */
const PAYMENT_APPROVED_CODE = 0;

const APPROVED_TEXT = ['APPROVED', 'SUCCESS', 'COMPLETED'];
const PENDING_TEXT = ['PENDING', 'PRE-AUTH', 'PREAUTH', 'PROCESSING'];

/**
 * Maps an ABA PayWay payment outcome (from check-transaction or the webhook
 * body) onto our own `payment_attempts.status` values. `paymentStatusCode`
 * is authoritative when present; the textual `paymentStatus` is the
 * fallback because not every endpoint returns the code. Anything
 * unrecognised stays `pending` — an attempt is only marked `failed` on an
 * explicit rejection, never on an ambiguous response.
 */
export function toPaymentAttemptOutcome(
  paymentStatusCode?: number | null,
  paymentStatus?: string | null,
): PaymentAttemptOutcome {
  if (paymentStatusCode === PAYMENT_APPROVED_CODE) {
    return 'succeeded';
  }

  const normalized = paymentStatus?.trim().toUpperCase() ?? '';

  if (APPROVED_TEXT.includes(normalized)) return 'succeeded';
  if (PENDING_TEXT.includes(normalized)) return 'pending';

  // A non-zero code is an explicit rejection from PayWay.
  if (typeof paymentStatusCode === 'number') return 'failed';

  return 'pending';
}
