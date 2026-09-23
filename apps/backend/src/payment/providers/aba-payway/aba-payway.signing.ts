import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ABA's **outbound request** signature for `check-transaction-2`/
 * `transaction-detail`: HMAC-SHA512 over `req_time + merchant_id + tran_id`,
 * base64-encoded. Not used for `purchase` (see `signAbaPaywayPurchase`,
 * which pads missing fields instead of skipping them — this function's
 * skip-on-null would desync a longer field list) or for callbacks (
 * `signAbaPaywayCallback` sorts by key instead of using a fixed order).
 */
export function signAbaPayway(values: unknown[], apiKey: string): string {
  const data = values
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join('');
  return createHmac('sha512', apiKey).update(data, 'utf-8').digest('base64');
}

/**
 * ABA's **purchase** signature — HMAC-SHA512 over exactly the 23 fields
 * concatenated in `signAbaPaywayPurchase` below, in that fixed positional
 * order. Unlike `signAbaPayway`, a missing field contributes an empty
 * string at its position rather than being skipped — dropping it instead
 * would shift every later field and desync the signature. Pass whatever
 * value actually ends up in the request body (e.g. `returnUrl` already
 * base64-encoded) — the hash must sign what's transmitted.
 */
export interface AbaPaywayPurchaseHashFields {
  reqTime: string;
  merchantId: string;
  tranId: string;
  amount: number | string;
  items?: string;
  shipping?: number | string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  type?: string;
  paymentOption?: string;
  returnUrl?: string;
  cancelUrl?: string;
  continueSuccessUrl?: string;
  returnDeeplink?: string;
  currency?: string;
  customFields?: string;
  returnParams?: string;
  payout?: string;
  lifetime?: number | string;
  additionalParams?: string;
  googlePayToken?: string;
  skipSuccessPage?: number | string;
}

export function signAbaPaywayPurchase(
  fields: AbaPaywayPurchaseHashFields,
  apiKey: string,
): string {
  const s = (value: string | number | undefined): string =>
    value === undefined ? '' : String(value);
  const data =
    s(fields.reqTime) +
    s(fields.merchantId) +
    s(fields.tranId) +
    s(fields.amount) +
    s(fields.items) +
    s(fields.shipping) +
    s(fields.firstname) +
    s(fields.lastname) +
    s(fields.email) +
    s(fields.phone) +
    s(fields.type) +
    s(fields.paymentOption) +
    s(fields.returnUrl) +
    s(fields.cancelUrl) +
    s(fields.continueSuccessUrl) +
    s(fields.returnDeeplink) +
    s(fields.currency) +
    s(fields.customFields) +
    s(fields.returnParams) +
    s(fields.payout) +
    s(fields.lifetime) +
    s(fields.additionalParams) +
    s(fields.googlePayToken) +
    s(fields.skipSuccessPage);
  return createHmac('sha512', apiKey).update(data, 'utf-8').digest('base64');
}

/**
 * ABA's **callback verification** signature: sort the payload's top-level
 * keys ascending, concatenate the values (non-strings JSON-encoded first),
 * HMAC-SHA512, base64. Compared against `X-PayWay-Hmac-Sha512` by
 * `verifyAbaPaywayCallbackSignature` below, in constant time.
 */
export function signAbaPaywayCallback(
  payload: Record<string, unknown>,
  apiKey: string,
): string {
  const data = Object.keys(payload)
    .sort()
    .map((key) => {
      const value = payload[key];
      return typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
    })
    .join('');
  return createHmac('sha512', apiKey).update(data, 'utf-8').digest('base64');
}

/**
 * Constant-time comparison of a computed callback signature against the
 * value received in the `X-PayWay-Hmac-Sha512` header — both are base64
 * HMAC digests of a fixed length when genuine, but `timingSafeEqual`
 * throws on mismatched buffer lengths rather than returning `false`, so a
 * forged (wrong-length) header is checked for that first.
 */
export function verifyAbaPaywayCallbackSignature(
  payload: Record<string, unknown>,
  apiKey: string,
  receivedSignature: string,
): boolean {
  const expected = Buffer.from(signAbaPaywayCallback(payload, apiKey));
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}
