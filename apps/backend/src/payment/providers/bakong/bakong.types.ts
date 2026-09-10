import type { BakongKhqrGenerateResult } from 'bakong-khqr';

export type { BakongKhqrGenerateResult };

/**
 * The Bakong account identity fed to `bakong-khqr` — sourced from config
 * (`bakong.*`), never from `ChargeRequest`. A client controlling whose KHQR
 * gets generated would let it redirect payer funds to an account we don't
 * control.
 *
 * Two shapes, matching the SDK's own `MerchantInfo`/`IndividualInfo` split:
 * `merchant` needs a registered `merchantId` + `acquiringBank` (business
 * onboarding through a participating bank/PSP); `individual` needs neither
 * — just the personal Bakong account alias (`name@bank`) anyone with a
 * Bakong-linked bank account already has. `BAKONG_MERCHANT_TYPE` picks
 * which one `BakongProvider` builds.
 */
export type BakongAccountConfig =
  | {
      type: 'individual';
      accountId: string;
      displayName: string;
      city: string;
    }
  | {
      type: 'merchant';
      accountId: string;
      displayName: string;
      city: string;
      merchantId: string;
      acquiringBank: string;
    };

/**
 * `POST {BAKONG_BASE_URL}/v1/check_transaction_by_md5` — field names taken
 * from NBC's publicly published Bakong Open API documentation, not
 * independently verified against a live sandbox call (same caveat class as
 * ABA PayWay's hash-order note in `../../SPEC.md`'s Open items). If a real
 * call comes back with different field names, this is the first place to
 * cross-check against Bakong's current merchant integration guide.
 */
export interface CheckTransactionByMd5Request {
  md5: string;
}

export interface CheckTransactionByMd5Data {
  hash?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  currency?: string | null;
  amount?: number | null;
  description?: string | null;
  createdDateMs?: number | null;
  acknowledgedDateMs?: number | null;
  trackingStatus?: string | null;
}

export interface CheckTransactionByMd5Response {
  /** 0 means Bakong found and returned the transaction; anything else is inconclusive (not yet paid, or unknown), never a hard rejection. */
  responseCode: number;
  responseMessage?: string | null;
  errorCode?: number | null;
  data?: CheckTransactionByMd5Data | null;
}
