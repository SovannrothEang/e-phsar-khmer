import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA512, base64, keyed by the merchant API key. ABA uses three
 * different field layouts — they are not interchangeable.
 */
const hmac = (data: string, apiKey: string): string =>
  createHmac('sha512', apiKey).update(data, 'utf-8').digest('base64');

/**
 * check-transaction / transaction-detail: `req_time + merchant_id + tran_id`.
 * `null`/`undefined` values are skipped.
 */
export function signAbaPayway(values: unknown[], apiKey: string): string {
  return hmac(
    values
      .filter((value) => value !== null && value !== undefined)
      .map(String)
      .join(''),
    apiKey,
  );
}

/** Purchase fields, in the exact order ABA hashes them. */
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

/**
 * purchase: the 23 fields above concatenated in order. A missing field is
 * `''` at its position — skipping it would shift every later field. Pass the
 * values as sent (e.g. `returnUrl` already base64).
 */
export function signAbaPaywayPurchase(
  fields: AbaPaywayPurchaseHashFields,
  apiKey: string,
): string {
  const s = (value: string | number | undefined): string =>
    value === undefined ? '' : String(value);
  return hmac(
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
      s(fields.skipSuccessPage),
    apiKey,
  );
}

/**
 * Callback (`X-PayWay-Hmac-Sha512`): sort the payload's top-level keys,
 * concatenate the values (non-strings JSON-encoded), then sign.
 */
export function signAbaPaywayCallback(
  payload: Record<string, unknown>,
  apiKey: string,
): string {
  return hmac(
    Object.keys(payload)
      .sort()
      .map((key) => {
        const value = payload[key];
        return typeof value === 'string'
          ? value
          : (JSON.stringify(value) ?? '');
      })
      .join(''),
    apiKey,
  );
}

/** Constant-time compare; `timingSafeEqual` throws on unequal lengths. */
export function verifyAbaPaywayCallbackSignature(
  payload: Record<string, unknown>,
  apiKey: string,
  receivedSignature: string,
): boolean {
  const expected = Buffer.from(signAbaPaywayCallback(payload, apiKey));
  const received = Buffer.from(receivedSignature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

interface RawJsonMember {
  key: string;
  /** The value exactly as it appears in the request body. */
  raw: string;
}

/**
 * Splits a flat JSON object into its members, keeping each value's source
 * text. Returns null for anything that is not one well-formed object.
 *
 * Why not `JSON.parse` alone: re-encoding a parsed body is lossy in exactly
 * the places a signature is computed over — `1.50` becomes `1.5`, `1e3`
 * becomes `1000`, an escaped `\u00e9` becomes `é`, a big integer loses
 * digits. ABA signed the bytes it sent, so the bytes are what we verify.
 */
export function splitTopLevelJsonObject(raw: string): RawJsonMember[] | null {
  const length = raw.length;
  let index = 0;

  const skipWhitespace = (): void => {
    while (index < length && /\s/.test(raw[index])) index++;
  };

  const readStringToken = (): string | null => {
    if (raw[index] !== '"') return null;
    const start = index;
    index++;
    while (index < length) {
      const char = raw[index];
      if (char === '\\') {
        index += 2;
        continue;
      }
      index++;
      if (char === '"') return raw.slice(start, index);
    }
    return null;
  };

  /** Consumes one value token: a scalar, or a nested object/array whole. */
  const readValueToken = (): string | null => {
    const start = index;
    let depth = 0;
    let inString = false;
    while (index < length) {
      const char = raw[index];
      if (inString) {
        if (char === '\\') {
          index += 2;
          continue;
        }
        if (char === '"') inString = false;
        index++;
        continue;
      }
      if (char === '"') {
        inString = true;
        index++;
        continue;
      }
      if (char === '{' || char === '[') {
        depth++;
        index++;
        continue;
      }
      if (char === '}' || char === ']') {
        if (depth === 0) break; // closes the enclosing object
        depth--;
        index++;
        continue;
      }
      if (char === ',' && depth === 0) break;
      index++;
    }
    const token = raw.slice(start, index).trim();
    return token.length > 0 ? token : null;
  };

  const members: RawJsonMember[] = [];
  skipWhitespace();
  if (raw[index] !== '{') return null;
  index++;
  skipWhitespace();
  if (raw[index] === '}') {
    index++;
    return index === length ? members : null;
  }

  for (;;) {
    skipWhitespace();
    const rawKey = readStringToken();
    if (rawKey === null) return null;
    let key: string;
    try {
      key = JSON.parse(rawKey) as string;
    } catch {
      return null;
    }
    skipWhitespace();
    if (raw[index] !== ':') return null;
    index++;
    skipWhitespace();
    const rawValue = readValueToken();
    if (rawValue === null) return null;
    members.push({ key, raw: rawValue });
    skipWhitespace();
    if (raw[index] === ',') {
      index++;
      continue;
    }
    if (raw[index] === '}') {
      index++;
      break;
    }
    return null;
  }

  skipWhitespace();
  return index === length ? members : null;
}

/**
 * The callback signature computed over the raw body instead of a re-encoded
 * payload. `null` when the body is not one well-formed object.
 *
 * Same rule as `signAbaPaywayCallback` (sort keys, concatenate values, JSON
 * for non-strings), but each value keeps the representation ABA sent. A
 * string token is decoded exactly once — ABA signs the string's content, not
 * its quotes — and every other token is used verbatim.
 */
export function signAbaPaywayCallbackRaw(
  rawJson: string,
  apiKey: string,
): string | null {
  const members = splitTopLevelJsonObject(rawJson);
  if (members === null) return null;

  const values = members
    .slice()
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ raw }) => {
      if (!raw.startsWith('"')) return raw;
      try {
        return String(JSON.parse(raw));
      } catch {
        // Unreachable for a token `splitTopLevelJsonObject` accepted; keeping
        // the quoted text is still the closer answer than dropping it.
        return raw.slice(1, -1);
      }
    });

  return hmac(values.join(''), apiKey);
}

/** Constant-time compare of the raw-body signature. */
export function verifyAbaPaywayCallbackSignatureRaw(
  rawJson: string,
  apiKey: string,
  receivedSignature: string,
): boolean {
  const expectedSignature = signAbaPaywayCallbackRaw(rawJson, apiKey);
  if (expectedSignature === null) return false;
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
