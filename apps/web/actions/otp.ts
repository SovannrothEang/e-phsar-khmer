"use server";

import { headers as nextHeaders } from "next/headers";
import { API_URL } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";
import type { DeviceIdentity } from "@/lib/device";
import { setUserDeviceId, setUserSession } from "@/lib/auth/session";

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
  error?: { code?: string; message?: string };
}

/** Ask the backend to re-send the OTP to `phone` (E.164). */
export async function requestOtp(
  phone: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_URL}/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
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
 * Login step 1: validate phone + password; the backend sends the OTP only
 * after the password checks out.
 */
export async function requestLoginOtp(
  phone: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_URL}/auth/otp/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<{
    otpSent: boolean;
  }> | null;

  if (!res.ok || !body?.success) {
    // Same contract as actions/login.ts: the domain string rides in `message`,
    // while `code` is only the HTTP status name.
    const code = body?.error?.message ?? body?.error?.code;
    return {
      success: false,
      error:
        code === "INVALID_CREDENTIALS"
          ? "Invalid phone number or password"
          : (body?.error?.message ?? "Failed to send code"),
    };
  }

  return { success: true };
}

/** Verify the 6-digit OTP; on success the user session cookies are set. */
export async function verifyOtp(
  phone: string,
  token: string,
  registration?: { password: string; firstName?: string; lastName?: string },
  device?: DeviceIdentity,
): Promise<
  | {
      success: true;
      user: { id: string; username: string | null; role: string };
      newDevice: boolean;
    }
  | { success: false; error: string }
> {
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
    return {
      success: false,
      error: body?.error?.message ?? "Invalid or expired code",
    };
  }

  const { user, accessToken, refreshToken } = body.data;

  await setUserSession({ accessToken, refreshToken });
  if (device) {
    try {
      await setUserDeviceId(device.id);
    } catch {
      /* the client-side mirror already wrote it */
    }
  }

  return {
    success: true,
    user: { id: user.id, username: user.username, role: user.role },
    newDevice: Boolean(body.data.newDevice),
  };
}
