"use server";

import { API_URL } from "@/lib/api/client";
import { isLocalPhone, normalizePhone } from "@/lib/phone";

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

function describeResetError(message: string | undefined, fallback: string) {
  if (message === "INVALID_OR_EXPIRED_OTP") return "Invalid or expired code.";
  if (message === "INVALID_RESET_TOKEN")
    return "Your reset session expired. Please start again.";
  return message ?? fallback;
}

/**
 * The reset form accepts a phone, a username, or an email. Only phone-shaped
 * values may be rewritten: applying `normalizePhone` to `855…` would turn it
 * into a different number, and to a digit-only username would mangle it.
 * Spaces/dashes are stripped from phone-shaped input because the backend
 * compares against the bare stored number.
 */
function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (!/^[+\d][\d\s-]{5,}$/.test(trimmed)) return trimmed;
  const compact = trimmed.replace(/[\s-]/g, "");
  return isLocalPhone(compact) ? normalizePhone(compact) : compact;
}

/**
 * Forgot-password step 1: ask the backend to text a code to the phone on the
 * account. The backend answers uniformly whether or not the identifier
 * matches, so callers must not treat success as proof the account exists.
 */
export async function requestPasswordReset(
  identifier: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_URL}/auth/password/reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: normalizeIdentifier(identifier) }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<{
    otpSent: boolean;
  }> | null;

  if (!res.ok || !body?.success) {
    return {
      success: false,
      error: body?.error?.message ?? "Failed to send code",
    };
  }

  return { success: true };
}

/**
 * Forgot-password step 2: verify the SMS code. The code is single-use, so
 * this returns a short-lived reset token the password step trades in — not a
 * session.
 */
export async function verifyPasswordResetCode(
  identifier: string,
  token: string,
): Promise<{ success: boolean; resetToken?: string; error?: string }> {
  const res = await fetch(`${API_URL}/auth/password/reset/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: normalizeIdentifier(identifier),
      token,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<{
    resetToken: string;
  }> | null;

  if (!res.ok || !body?.success || !body.data?.resetToken) {
    return {
      success: false,
      error: describeResetError(
        body?.error?.message,
        "Failed to verify the code",
      ),
    };
  }

  return { success: true, resetToken: body.data.resetToken };
}

/**
 * Forgot-password step 3: trade the reset token for a new password. Success
 * does NOT sign the user in — the page sends them to /login.
 */
export async function confirmPasswordReset(
  resetToken: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return {
      success: false,
      error: "Your password must be at least 8 characters long.",
    };
  }
  if (newPassword.length > 72) {
    // bcrypt silently ignores bytes past 72; refusing is honest.
    return {
      success: false,
      error: "Your password must be at most 72 characters long.",
    };
  }

  const res = await fetch(`${API_URL}/auth/password/reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetToken, newPassword }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<{
    reset: boolean;
  }> | null;

  if (!res.ok || !body?.success) {
    return {
      success: false,
      error: describeResetError(
        body?.error?.message,
        "Failed to reset password",
      ),
    };
  }

  return { success: true };
}
