/**
 * ABA PayWay's purchase API documents `return_url` as: "URL to receive
 * callbacks upon payment completion, encrypted with Base64." Despite the
 * word "encrypted", this is base64 *encoding* (reversible, no key) — there
 * is no separate encrypt key involved in the purchase request, only the
 * HMAC `apiKey` used for `hash` (see `aba-payway.signing.ts`). Confirmed
 * against ABA's own documented field description, not inferred from the
 * `payway-gateway` reference implementation — that reference never
 * actually applies this encoding to `return_url` (it has an unused
 * `EncodeBase64Builder` utility sitting dead in `common/utils/`, which is
 * a hint this exact step was left unfinished there).
 */
export function base64EncodeAbaPaywayUrl(url: string): string {
  return Buffer.from(url, 'utf-8').toString('base64');
}

/**
 * ABA PayWay's `req_time` wire format, confirmed against ABA's own
 * developer docs (developer.payway.com.kh/purchase-14530820e0 and
 * .../check-transaction-14530826e0, both state "Request date and time in
 * UTC format as YYYYMMDDHHmmss"): a 14-digit UTC timestamp, not epoch
 * milliseconds. This superseded a previous `String(Date.now())`
 * implementation that would never have matched what ABA expects on a live
 * call — see the module README's Open items for how this was found.
 */
export function formatAbaPaywayReqTime(date: Date): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}
