import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ABA PayWay's **outbound request** signature for `check-transaction-2`
 * and `transaction-detail`: HMAC-SHA512 over the plain concatenation of
 * `req_time + merchant_id + tran_id` (the only three fields either
 * endpoint takes), keyed by the merchant's API key, base64-encoded.
 * Confirmed against ABA's own developer docs
 * (developer.payway.com.kh/check-transaction-14530826e0), including its
 * PHP sample (`$req_time . $merchant_id . $tran_id`) — this one was
 * already correct.
 *
 * **Not used for `purchase`** — that endpoint signs a much longer,
 * mostly-optional field list where a missing field must still occupy its
 * position as an empty string (see `signAbaPaywayPurchase` below); this
 * function's null/undefined-skipping behavior would silently shift every
 * field after the first gap; that's fine here because check-transaction
 * and transaction-detail only ever have their three required fields.
 *
 * This is also a *different* algorithm from `signAbaPaywayCallback` below
 * — ABA documents the two separately (fixed field order for requests you
 * send it; sort-by-key over the whole payload for callbacks it sends you)
 * — do not assume they're interchangeable.
 */
export function signAbaPayway(values: unknown[], apiKey: string): string {
  const data = values
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join('');
  return createHmac('sha512', apiKey).update(data, 'utf-8').digest('base64');
}

/**
 * ABA PayWay's **purchase** signature — a distinct, longer algorithm from
 * `signAbaPayway` above, confirmed against ABA's own developer docs
 * (developer.payway.com.kh/purchase-14530820e0): HMAC-SHA512 over the
 * plain concatenation of exactly these 23 fields, in this fixed positional
 * order, base64-encoded:
 *
 * `req_time, merchant_id, tran_id, amount, items, shipping, firstname,
 * lastname, email, phone, type, payment_option, return_url, cancel_url,
 * continue_success_url, return_deeplink, currency, custom_fields,
 * return_params, payout, lifetime, additional_params, google_pay_token,
 * skip_success_page`
 *
 * Unlike `signAbaPayway`, a missing optional field contributes an **empty
 * string at its position**, never a skip — this is positional
 * concatenation (confirmed by ABA's PHP sample style, where an unset
 * variable interpolates as `''`), so dropping a field instead of leaving
 * its slot empty would shift every field after it and desync the whole
 * signature. Pass whatever value ends up in the actual request body for
 * a field that IS sent (e.g. `returnUrl` already base64-encoded) — the
 * hash must sign exactly what's transmitted, not the pre-transform value.
 *
 * This superseded a previous 5-field implementation (`req_time,
 * merchant_id, tran_id, amount, currency`, in that order) that was wrong
 * on both field order and field count — see the module README's Open
 * items for how this was found and confirmed.
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
 * ABA PayWay's **callback verification** signature, confirmed against
 * ABA's own documentation ("Verify Callback Signature"):
 *
 * 1. Sort the payload's top-level keys ascending.
 * 2. Concatenate the values in that key order — a nested object/array is
 *    JSON-encoded first; every field ABA documents for this payload
 *    (`tran_id`, `apv`, `status`, `return_params`, `merchant_ref`) is a
 *    plain string, so in practice this is just those five values in key
 *    order, but any other JSON-scalar type is handled too.
 * 3. HMAC-SHA512 over that string, keyed by the merchant API key, digest
 *    base64-encoded.
 *
 * The result is compared against the `X-PayWay-Hmac-Sha512` request header
 * — see `verifyAbaPaywayCallbackSignature`, which does that comparison in
 * constant time.
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
