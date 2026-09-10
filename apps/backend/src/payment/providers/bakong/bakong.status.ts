import type { PaymentAttemptOutcome } from '../payment-gateway.types';
import type { CheckTransactionByMd5Response } from './bakong.types';

/** Bakong returns 0 on `responseCode` when it found and returned the transaction. */
export const BAKONG_API_OK = 0;

/**
 * Maps a check_transaction_by_md5 response onto our own
 * `payment_attempts.status` values. Unlike ABA, Bakong's API has no
 * explicit "rejected" outcome for a KHQR — a payer either scans and pays or
 * doesn't, so anything short of a found transaction stays `pending`. This
 * provider never returns `failed` from reconcile() itself; a stale/expired
 * QR that's never getting paid is a lifetime concern the caller has to
 * enforce (see the module README's Open items) — reconcile() only reports
 * what Bakong currently knows.
 */
export function toPaymentAttemptOutcome(
  response: CheckTransactionByMd5Response,
): PaymentAttemptOutcome {
  if (response.responseCode === BAKONG_API_OK && response.data) {
    return 'succeeded';
  }
  return 'pending';
}
