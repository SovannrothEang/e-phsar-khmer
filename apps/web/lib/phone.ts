/**
 * Normalize a user-entered phone number to E.164 (`+855…`) for the auth API.
 *
 * The register form collects local Cambodian numbers (`0XXXXXXXXX`), while the
 * backend requires `^\+?[1-9]\d{6,14}$` (a leading `0` is rejected), so every
 * phone must go through this before hitting `/auth/*`. Returns `""` when the
 * input cannot produce a plausible number.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const hasCountryCode = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  // Local numbers drop their leading 0 and gain the +855 country code.
  const e164 = hasCountryCode
    ? `+${digits}`
    : `+855${digits.replace(/^0/, "")}`;

  return e164.replace(/\D/g, "").length >= 8 ? e164 : "";
}

/**
 * Render an E.164 Cambodian number (`+855…`) in the local `0…` format users
 * typed on the register form. Non-`+855` numbers pass through unchanged.
 */
export function formatPhoneLocal(phone: string): string {
  return phone.replace(/^\+855/, "0");
}

/** True when the raw value is a local Cambodian phone: leading 0 + 7-9 digits. */
export function isLocalPhone(raw: string): boolean {
  return /^0\d{7,9}$/.test(raw.trim());
}
