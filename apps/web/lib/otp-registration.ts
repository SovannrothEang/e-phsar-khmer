/**
 * Handoff between the register/login forms and the OTP page.
 *
 * The password (and, at registration, the names) must reach the verify call
 * but must NEVER appear in a URL, so they travel via sessionStorage: it
 * survives refresh in the same tab, is not shared across tabs, and never
 * lands in browser history or server logs.
 */
export const OTP_REGISTRATION_KEY = "otp_registration";

export interface OtpRegistration {
  mode: "register" | "login";
  /** E.164 — must match the OTP page's ?phone= param. */
  phone: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export function storeOtpRegistration(payload: OtpRegistration): void {
  try {
    sessionStorage.setItem(OTP_REGISTRATION_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota — the verify will proceed without the payload.
  }
}

/**
 * Returns the pending handoff for this phone, or null (none/stale/corrupt).
 * A stale entry for a different phone is discarded.
 */
export function readOtpRegistration(phone: string): OtpRegistration | null {
  try {
    const raw = sessionStorage.getItem(OTP_REGISTRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OtpRegistration>;
    if (parsed.phone !== phone) {
      sessionStorage.removeItem(OTP_REGISTRATION_KEY);
      return null;
    }
    if (
      (parsed.mode !== "register" && parsed.mode !== "login") ||
      typeof parsed.password !== "string" ||
      parsed.password.length < 8
    ) {
      return null;
    }
    return {
      mode: parsed.mode,
      phone,
      password: parsed.password,
      firstName:
        typeof parsed.firstName === "string"
          ? parsed.firstName.slice(0, 100)
          : undefined,
      lastName:
        typeof parsed.lastName === "string"
          ? parsed.lastName.slice(0, 100)
          : undefined,
    };
  } catch {
    return null; // corrupt JSON / storage unavailable
  }
}

export function clearOtpRegistration(): void {
  try {
    sessionStorage.removeItem(OTP_REGISTRATION_KEY);
  } catch {
    // ignore
  }
}
