import type { PaymentAttemptOutcome } from '../payment-gateway.types';
import type { CheckTransactionByMd5Response } from './bakong.types';

/** Bakong returns 0 on `responseCode` when it found and returned the transaction. */
export const BAKONG_API_OK = 0;

/**
 * Maps a check_transaction_by_md5 response onto `payment_attempts.status`.
 * Bakong has no "rejected" outcome for a KHQR — anything short of a found
 * transaction stays `pending`; this never returns `failed` (an expired QR
 * is the caller's lifetime concern, not something reconcile() decides).
 */
export function toPaymentAttemptOutcome(
  response: CheckTransactionByMd5Response,
): PaymentAttemptOutcome {
  if (response.responseCode === BAKONG_API_OK && response.data) {
    return 'succeeded';
  }
  return 'pending';
}
