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
