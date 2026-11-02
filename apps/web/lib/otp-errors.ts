/**
 * DOM-free helpers for the phone-OTP flows (register, login-by-OTP, resend,
 * forgot-password). The backend answers every failure with
 * `{ success: false, error: { code, message, details? } }`; `code` is a domain
 * string for OTP failures and the HTTP status name otherwise. Success carries
 * `{ success: true, data: { otpSent, retryAfterSeconds } }`.
 */

/** Shown when the backend gives no usable wait (matches its default cooldown). */
export const DEFAULT_RETRY_SECONDS = 60;

export type OtpErrorCode =
  | "cooldown"
  | "daily_cap"
  | "send_failed"
  | "provider_unsupported"
  | "too_many_attempts"
  | "invalid_code"
  | "invalid_credentials"
  | "validation"
  | "unknown";

export interface OtpFailure {
  success: false;
  code: OtpErrorCode;
  /** Raw backend message, only a fallback for `unknown`. */
  message?: string;
  /** Present for `cooldown`. */
  retryAfterSeconds?: number;
}

export interface OtpSent {
  success: true;
  retryAfterSeconds: number;
}

export type OtpSendResult = OtpSent | OtpFailure;

interface ErrorBody {
  success?: boolean;
  data?: { otpSent?: boolean; retryAfterSeconds?: unknown; reset?: boolean };
  error?: {
    code?: string;
    message?: string;
    retryAfterSeconds?: unknown;
    details?: unknown;
  };
}

export function toRetrySeconds(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : undefined;
}

function retryFromError(
  body: ErrorBody | null,
  retryAfterHeader?: string | null,
): number | undefined {
  const err = body?.error;
  const fromDetails =
    err?.details && typeof err.details === "object"
      ? (err.details as { retryAfterSeconds?: unknown }).retryAfterSeconds
      : undefined;
  return (
    toRetrySeconds(err?.retryAfterSeconds) ??
    toRetrySeconds(fromDetails) ??
    toRetrySeconds(Number(retryAfterHeader))
  );
}

/**
 * Map a failed backend response to a stable code. `message` is the backend's
 * domain string (e.g. `INVALID_CREDENTIALS`, `Invalid or expired OTP`).
 */
export function parseOtpFailure(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): OtpFailure {
  const parsed = (body ?? null) as ErrorBody | null;
  const code = parsed?.error?.code;
  const message = parsed?.error?.message;

  switch (code) {
    case "OTP_COOLDOWN":
      return {
        success: false,
        code: "cooldown",
        retryAfterSeconds:
          retryFromError(parsed, retryAfterHeader) ?? DEFAULT_RETRY_SECONDS,
      };
    case "OTP_DAILY_CAP":
      return { success: false, code: "daily_cap" };
    case "OTP_SEND_FAILED":
      return { success: false, code: "send_failed" };
    case "OTP_PROVIDER_UNSUPPORTED":
      return { success: false, code: "provider_unsupported" };
    case "OTP_TOO_MANY_ATTEMPTS":
      return { success: false, code: "too_many_attempts" };
    default:
  }

  if (message === "INVALID_CREDENTIALS") {
    return { success: false, code: "invalid_credentials" };
  }
  if (status === 401 && message === "Invalid or expired OTP") {
    return { success: false, code: "invalid_code" };
  }
  if (status === 400) {
    return { success: false, code: "validation", message };
  }
  // The global throttler answers 429 without a domain code.
  if (status === 429) {
    return {
      success: false,
      code: "cooldown",
      retryAfterSeconds:
        retryFromError(parsed, retryAfterHeader) ?? DEFAULT_RETRY_SECONDS,
    };
  }
  if (status === 503) return { success: false, code: "send_failed" };
  return { success: false, code: "unknown", message };
}

/** Read a send/resend success body; falls back to the default cooldown. */
export function parseOtpSent(body: unknown): OtpSent | null {
  const parsed = (body ?? null) as ErrorBody | null;
  if (!parsed?.success || !parsed.data?.otpSent) return null;
  return {
    success: true,
    retryAfterSeconds:
      toRetrySeconds(parsed.data.retryAfterSeconds) ?? DEFAULT_RETRY_SECONDS,
  };
}

/** Under two minutes read as seconds, otherwise as whole minutes (rounded up). */
export function formatWait(seconds: number): {
  unit: "seconds" | "minutes";
  value: number;
} {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 120) return { unit: "seconds", value: s };
  return { unit: "minutes", value: Math.ceil(s / 60) };
}
