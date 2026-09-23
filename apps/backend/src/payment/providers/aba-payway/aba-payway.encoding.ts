/**
 * ABA docs call `return_url` "encrypted with Base64" — despite the wording
 * this is plain base64 *encoding* (reversible, no key); the only key
 * involved anywhere in the purchase request is the HMAC `apiKey` used for
 * `hash` (see `aba-payway.signing.ts`).
 */
export function base64EncodeAbaPaywayUrl(url: string): string {
  return Buffer.from(url, 'utf-8').toString('base64');
}

/** ABA's `req_time` wire format: a 14-digit UTC timestamp (`YYYYMMDDHHmmss`), not epoch milliseconds — per ABA's developer docs. */
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
