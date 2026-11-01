/**
 * Cambodian-first phone handling for the auth forms.
 *
 * The backend accepts E.164 only (`^\+?[1-9]\d{6,14}$`), while the screens
 * take free text (`015 455 758`, `+855 15 455 758`, …). Everything is
 * normalized here before it reaches the API.
 */

/** Local Cambodian mobile: 0 + 8–9 digits (e.g. 015455758). */
const LOCAL_PHONE = /^0\d{8,9}$/;
/** Cambodia with a country code, with or without the leading plus. */
const KH_PHONE = /^\+?855\d{8,9}$/;
/** Any other international number already carrying a plus. */
const INTL_PHONE = /^\+[1-9]\d{6,14}$/;

function compact(input: string): string {
  return input.replace(/[\s\-().]/g, "");
}

/** True when this identifier should take the OTP login path, not password login. */
export function looksLikePhone(input: string): boolean {
  const value = compact(input);
  return LOCAL_PHONE.test(value) || KH_PHONE.test(value);
}

/** E.164 form for the API, or null when the input is not a usable phone. */
export function normalizePhone(input: string): string | null {
  const value = compact(input);
  if (LOCAL_PHONE.test(value)) return `+855${value.slice(1)}`;
  if (/^855\d{8,9}$/.test(value)) return `+${value}`;
  if (INTL_PHONE.test(value)) return value;
  return null;
}
