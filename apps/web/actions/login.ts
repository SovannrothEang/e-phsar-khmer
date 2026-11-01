"use server";

import { headers as nextHeaders } from "next/headers";
import { loginSchema } from "@/schemas/login";
import { setUserDeviceId, setUserSession } from "@/lib/auth/session";
import { API_URL } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";
import type { DeviceIdentity } from "@/lib/device";
import z from "zod";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: BackendUser;
  /** True when this login came from a new, non-first device. */
  newDevice?: boolean;
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
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok || !body?.success || !body.data) {
    // The backend sends the HTTP status name in `code` ("UNAUTHORIZED") and the
    // domain string in `message` ("INVALID_CREDENTIALS") — matching the code
    // here could never be true, so the raw "INVALID_CREDENTIALS" leaked to the
    // user. Match the message.
    const code = body?.error?.message ?? body?.error?.code;
    return {
      success: false,
      error:
        code === "INVALID_CREDENTIALS"
          ? "Invalid username or password"
          : (body?.error?.message ?? "Login failed"),
    };
  }

  const { user, accessToken, refreshToken } = body.data;

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

  return {
    success: true,
    user: { id: user.id, username: user.username, role: user.role },
    newDevice: Boolean(body.data.newDevice),
  };
}
