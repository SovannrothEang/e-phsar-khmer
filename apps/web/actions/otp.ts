"use server";

import { headers as nextHeaders } from "next/headers";
import { API_URL } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";
import type { DeviceIdentity } from "@/lib/device";
import { setUserDeviceId, setUserSession } from "@/lib/auth/session";
import { redirect as i18nRedirect } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import {
  parseOtpFailure,
  parseOtpSent,
  type OtpErrorCode,
} from "@/lib/otp-errors";

interface OtpVerifyResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: BackendUser;
  /** True when this login came from a new, non-first device. */
  newDevice?: boolean;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
}

/** The contact channels a suspended account can appeal through. */
interface SuspensionSupport {
  email?: string;
  telegram?: string;
  phone?: string;
}

interface SuspendedOtp {
  reason: string | null;
  support: SuspensionSupport;
}

/** Result of any OTP-send endpoint (request, resend). */
export type OtpSendActionResult =
  | { success: true; retryAfterSeconds: number }
  | {
      success: false;
      /** Raw backend message when it has one; map `code` for the rest. */
      error?: string;
      code: OtpErrorCode;
      /** Present for a cooldown/429 — drive the countdown from it. */
      retryAfterSeconds?: number;
    };

/**
 * Shared reader for every send-shaped endpoint: success carries the API's own
 * wait, failures carry a stable code (lib/otp-errors.ts) plus whatever wait
 * the body or the `Retry-After` header reported.
 */
async function parseSendResponse(res: Response): Promise<OtpSendActionResult> {
  const body = await res.json().catch(() => null);
  if (res.ok) {
    const sent = parseOtpSent(body);
    if (sent) {
      return { success: true, retryAfterSeconds: sent.retryAfterSeconds };
    }
  }
  const failure = parseOtpFailure(
    res.status,
    body,
    res.headers.get("retry-after"),
  );
  return {
    success: false,
    code: failure.code,
    ...(failure.message !== undefined ? { error: failure.message } : {}),
    ...(failure.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: failure.retryAfterSeconds }
      : {}),
  };
}

/** Ask the backend to re-send the OTP to `phone` (E.164). */
export async function requestOtp(phone: string): Promise<OtpSendActionResult> {
  const res = await fetch(`${API_URL}/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
    cache: "no-store",
  });
  return parseSendResponse(res);
}

/**
 * Login step 1: validate phone + password; the backend sends the OTP only
 * after the password checks out. Same send-shaped answer as `requestOtp`, so
 * the countdown and the cooldown/daily-cap copy come from the API, not from a
 * hard-coded 60 s.
 */
export async function requestLoginOtp(
  phone: string,
  password: string,
): Promise<OtpSendActionResult> {
  const res = await fetch(`${API_URL}/auth/otp/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
    cache: "no-store",
  });
  return parseSendResponse(res);
}

/** Verify the 6-digit OTP; on success the user session cookies are set. */
export async function verifyOtp(
  phone: string,
  token: string,
  registration?: {
    /** `register` makes the API refuse a number that already has an account. */
    mode?: "register" | "login";
    password: string;
    firstName?: string;
    lastName?: string;
  },
  device?: DeviceIdentity,
  // No success branch: the flow ends in a redirect (below). The inferred
  // `| undefined` is what the client sees — on success the framework rejects
  // the call with its redirect signal, so `res` is never a success value.
) {
  if (registration && registration.password.length < 8) {
    return { success: false, error: "Invalid input" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (device) {
    headers["x-device-id"] = device.id;
    headers["x-device-name"] = device.name;
    const incoming = await nextHeaders();
    headers["x-device-info"] = encodeURIComponent(
      JSON.stringify({
        type: "browser",
        clientVersion: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
        userAgent: incoming.get("user-agent") ?? undefined,
      }),
    );
  }

  const res = await fetch(`${API_URL}/auth/otp/verify`, {
    method: "POST",
    headers,
    // Pick fields explicitly — the handoff object carries `mode`/`phone`
    // for the web flow, and the backend's whitelist rejects unknown props.
    body: JSON.stringify({
      phone,
      token,
      ...(registration
        ? {
            mode: registration.mode,
            password: registration.password,
            firstName: registration.firstName,
            lastName: registration.lastName,
          }
        : {}),
    }),
    cache: "no-store",
  });
  const body = (await res
    .json()
    .catch(() => null)) as Envelope<OtpVerifyResponse> | null;

  if (!res.ok || !body?.success || !body.data) {
    // A suspended account is not a code problem: the OTP form must show the
    // same dialog the password form shows, with the reason and the contacts.
    if (body?.error?.code === "ACCOUNT_SUSPENDED") {
      const details = (body.error.details ?? {}) as {
        reason?: string | null;
        support?: SuspensionSupport;
      };
      return {
        success: false as const,
        error: body.error.message ?? "This account is suspended.",
        suspended: {
          reason: details.reason ?? body.error.message ?? null,
          support: details.support ?? {},
        } satisfies SuspendedOtp,
      };
    }
    return {
      success: false as const,
      error: body?.error?.message ?? "Invalid or expired code",
    };
  }

  const { accessToken, refreshToken } = body.data;

  await setUserSession({ accessToken, refreshToken });
  if (device) {
    try {
      await setUserDeviceId(device.id);
    } catch {
      /* the client-side mirror already wrote it */
    }
  }

  // Redirect HERE, not from the client. Setting cookies makes Next answer a
  // Server Action by re-rendering the route it was called from and shipping
  // that tree back, so the client cannot navigate until a page the user is
  // leaving has fully rendered (measured 8.4s of the 10.9s verify on /otp).
  // A redirect answers the action without that re-render.
  const locale = await getLocale();
  i18nRedirect({ href: "/me", locale });
}
