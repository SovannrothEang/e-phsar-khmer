"use server";

import { loginSchema } from "@/schemas/login";
import { setUserSession } from "@/lib/auth/session";
import { API_URL } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";
import z from "zod";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: BackendUser;
}

export async function login(unsafeData: z.infer<typeof loginSchema>) {
  const parsed = loginSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { login: identifier, password } = parsed.data;

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  return {
    success: true,
    user: { id: user.id, username: user.username, role: user.role },
  };
}
