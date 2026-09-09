import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ABA PayWay's **outbound request** signature (purchase, check-transaction):
 * HMAC-SHA512 over the plain concatenation of the request's required values,
 * in the API's documented positional order, keyed by the merchant's API
 * key, base64-encoded. Ported from the verified `payway-gateway` reference.
 * This is a *different* algorithm from `signAbaPaywayCallback` below —
 * ABA documents the two separately (fixed field order for requests you send
 * it; sort-by-key over the whole payload for callbacks it sends you) — do
 * not assume they're interchangeable.
 *
 * `null`/`undefined` values are skipped rather than stringified as
 * "null"/"undefined" — an absent optional field must contribute nothing to
 * the signed string, or the hash won't match what ABA computes on its side
 * for the same (sparse) request.
 */
export function signAbaPayway(values: unknown[], apiKey: string): string {
  const data = values
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join('');
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
