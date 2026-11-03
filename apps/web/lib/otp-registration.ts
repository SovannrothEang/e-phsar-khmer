import { toRetrySeconds } from "./otp-errors.ts";

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
  /**
   * The wait the send endpoint applied (see `actions/register.ts`). The OTP
   * page seeds its resend countdown from it instead of assuming 60 s.
   */
  retryAfterSeconds?: number;
  /**
   * When the send happened, so a reload 200 s later does not restart the whole
   * countdown. Set by `storeOtpRegistration` when the caller omits it.
   */
  sentAt?: number;
}

export function storeOtpRegistration(payload: OtpRegistration): void {
  try {
    sessionStorage.setItem(
      OTP_REGISTRATION_KEY,
      JSON.stringify({ ...payload, sentAt: payload.sentAt ?? Date.now() }),
    );
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
      retryAfterSeconds: toRetrySeconds(parsed.retryAfterSeconds),
      sentAt:
        typeof parsed.sentAt === "number" &&
        Number.isFinite(parsed.sentAt) &&
        parsed.sentAt > 0 &&
        parsed.sentAt <= Date.now() + 60_000
          ? parsed.sentAt
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

/**
 * #32: the registration form's own draft, kept while the user is typing so a
 * reload or a back-navigation does not throw away a half-filled form.
 *
 * Same trust boundary as the handoff above (sessionStorage, this tab only,
 * never a URL), and `confirmPassword` is deliberately not part of it: it is
 * only a local confirmation, so it is asked again after a restore.
 */
export const REGISTER_DRAFT_KEY = "register_draft";

/** A stale draft must not resurrect itself days later. */
export const REGISTER_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegisterDraft {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  password: string;
}

interface StoredRegisterDraft extends RegisterDraft {
  /** Epoch ms; drives the TTL check on read. */
  savedAt: number;
}

function draftText(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function storeRegisterDraft(draft: RegisterDraft): void {
  try {
    const snapshot: RegisterDraft = {
      firstName: draft.firstName.slice(0, 100),
      lastName: draft.lastName.slice(0, 100),
      phoneNumber: draft.phoneNumber.slice(0, 32),
      password: draft.password.slice(0, 200),
    };
    // Nothing typed yet — an empty snapshot is just noise on the next visit.
    if (!Object.values(snapshot).some((value) => value.trim() !== "")) {
      sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      return;
    }
    const stored: StoredRegisterDraft = { ...snapshot, savedAt: Date.now() };
    sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(stored));
  } catch {
    // Private mode / quota — the form still works, it just does not persist.
  }
}

/** The pending draft, or null (none/expired/corrupt). Drops it once stale. */
export function readRegisterDraft(): RegisterDraft | null {
  try {
    const raw = sessionStorage.getItem(REGISTER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRegisterDraft>;
    const savedAt = readSavedAt(parsed.savedAt);
    if (savedAt === null || Date.now() - savedAt > REGISTER_DRAFT_TTL_MS) {
      sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      return null;
    }
    return {
      firstName: draftText(parsed.firstName, 100),
      lastName: draftText(parsed.lastName, 100),
      phoneNumber: draftText(parsed.phoneNumber, 32),
      password: draftText(parsed.password, 200),
    };
  } catch {
    return null; // corrupt JSON / storage unavailable
  }
}

function readSavedAt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  // A clock that moved backwards must not keep a draft alive forever.
  return value > Date.now() ? null : value;
}

export function clearRegisterDraft(): void {
  try {
    sessionStorage.removeItem(REGISTER_DRAFT_KEY);
  } catch {
    // ignore
  }
}
