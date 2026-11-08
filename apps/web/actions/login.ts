"use server";

import { headers as nextHeaders } from "next/headers";
import { loginSchema } from "@/schemas/login";
import { setUserDeviceId, setUserSession } from "@/lib/auth/session";
import { API_URL } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";
import type { DeviceIdentity } from "@/lib/device";
import { redirect as i18nRedirect } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import z from "zod";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: BackendUser;
  /** True when this login came from a new, non-first device. */
  newDevice?: boolean;
}

/** The contact channels a suspended account can appeal through. */
export interface SuspensionSupport {
  email?: string;
  telegram?: string;
  phone?: string;
}

export interface SuspendedLogin {
  /** The staff-written reason, when the suspension recorded one. */
  reason: string | null;
  support: SuspensionSupport;
}

export async function login(
  unsafeData: z.infer<typeof loginSchema>,
  device?: DeviceIdentity,
) {
  const parsed = loginSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { login: identifier, password } = parsed.data;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (device) {
    headers["x-device-id"] = device.id;
    headers["x-device-name"] = device.name;
    // The backend parses the raw browser UA; the build stamp is the second
    // line of the settings/devices row ("Browser 2026.10.20").
    const incoming = await nextHeaders();
    headers["x-device-info"] = encodeURIComponent(
      JSON.stringify({
        type: "browser",
        clientVersion: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
        userAgent: incoming.get("user-agent") ?? undefined,
      }),
    );
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ identifier, password }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: LoginResponse;
    error?: { code?: string; message?: string; details?: unknown };
  } | null;

  if (!res.ok || !body?.success || !body.data) {
    // A suspension is not a credential problem: the account is blocked and
    // the only way forward is contacting staff, so it is returned as its own
    // shape for the form to render a dialog instead of a toast.
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
        },
      };
    }
    // The filter forwards a thrower's custom `code` when one is passed (that is
    // what the ACCOUNT_SUSPENDED branch above relies on) and the HTTP status
    // name otherwise. A plain credential failure carries no custom code: the
    // domain string "INVALID_CREDENTIALS" arrives in `message`, which is why
    // this matches on the message.
    const code = body?.error?.message ?? body?.error?.code;
    return {
      success: false as const,
      error:
        code === "INVALID_CREDENTIALS"
          ? "Invalid username or password"
          : (body?.error?.message ?? "Login failed"),
    };
  }

  const { accessToken, refreshToken } = body.data;

  await setUserSession({ accessToken, refreshToken });
  // Belt and braces with the browser mirror: the server write survives a
  // client that blocks document.cookie. Never fail a real login over it.
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
  // leaving has fully rendered (measured 8.4s on /otp). A redirect answers
  // the action without that re-render — the current route is simply left.
  const locale = await getLocale();
  i18nRedirect({ href: "/me", locale });
}
