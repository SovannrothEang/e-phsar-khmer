"use server";

import z from "zod";
import { loginSchema } from "@/schemas/login";
import { setAdminSession } from "@/lib/auth/session";
import { setAdminLocale } from "@/lib/auth/admin-locale";
import { API_URL } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";

type AdminRole = "admin" | "super_admin";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: BackendUser;
}

/**
 * Admin-only login for the /wanderer/* surface. Calls the same
 * POST /api/v1/auth/login endpoint as the user flow, but rejects any account
 * whose role is not `admin` or `super_admin`. On success, persists the admin
 * session cookies AND seeds the `admin_locale` cookie from the user's
 * `preferredLanguage` so the non-localized admin UI renders in the right
 * language immediately.
 */
export async function adminLogin(unsafeData: z.infer<typeof loginSchema>) {
  const parsed = loginSchema.safeParse(unsafeData);
  if (!parsed.success)
    return { success: false as const, error: "Invalid input" };

  const { login: identifier, password } = parsed.data;

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    success?: true;
    data?: LoginResponse;
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok || !body?.success || !body.data) {
    const code = body?.error?.code ?? body?.error?.message;
    return {
      success: false as const,
      error:
        code === "INVALID_CREDENTIALS"
          ? "Invalid username or password"
          : (body?.error?.message ?? "Login failed"),
    };
  }

  const { user, accessToken, refreshToken } = body.data;
  if (user.role !== "admin" && user.role !== "super_admin") {
    return {
      success: false as const,
      error: "This account is not authorized for the admin dashboard",
    };
  }

  await setAdminSession({ accessToken, refreshToken });
  const locale = ["en", "km", "zh", "ko", "id", "vi"].includes(
    user.preferredLanguage,
  )
    ? user.preferredLanguage
    : "en";
  await setAdminLocale(locale);

  return {
    success: true as const,
    user: {
      id: user.id,
      username: user.username,
      role: user.role as AdminRole,
    },
  };
}
