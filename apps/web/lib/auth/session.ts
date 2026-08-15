import { cookies } from "next/headers";

export const ADMIN_ACCESS_TOKEN_COOKIE = "admin_access_token";
export const ADMIN_REFRESH_TOKEN_COOKIE = "admin_refresh_token";
export const USER_ACCESS_TOKEN_COOKIE = "user_access_token";
export const USER_REFRESH_TOKEN_COOKIE = "user_refresh_token";

/** Backward-compatible alias — the proxy guards the admin cookie. */
export const ACCESS_TOKEN_COOKIE = ADMIN_ACCESS_TOKEN_COOKIE;
export const REFRESH_TOKEN_COOKIE = ADMIN_REFRESH_TOKEN_COOKIE;

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: THIRTY_DAYS,
  };
}

// ── Admin session ───────────────────────────────────────────────────────────

/** Persist admin tokens in httpOnly cookies. Server Action / Route Handler only. */
export async function setAdminSession(tokens: SessionTokens): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions());
  store.set(ADMIN_REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions());
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_ACCESS_TOKEN_COOKIE);
  store.delete(ADMIN_REFRESH_TOKEN_COOKIE);
}

export async function getAdminAccessToken(): Promise<string | null> {
  return (await cookies()).get(ADMIN_ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getAdminRefreshToken(): Promise<string | null> {
  return (await cookies()).get(ADMIN_REFRESH_TOKEN_COOKIE)?.value ?? null;
}

// ── User session ────────────────────────────────────────────────────────────

/** Persist user tokens in httpOnly cookies. Server Action / Route Handler only. */
export async function setUserSession(tokens: SessionTokens): Promise<void> {
  const store = await cookies();
  store.set(USER_ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions());
  store.set(USER_REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions());
}

export async function clearUserSession(): Promise<void> {
  const store = await cookies();
  store.delete(USER_ACCESS_TOKEN_COOKIE);
  store.delete(USER_REFRESH_TOKEN_COOKIE);
}

export async function getUserAccessToken(): Promise<string | null> {
  return (await cookies()).get(USER_ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getUserRefreshToken(): Promise<string | null> {
  return (await cookies()).get(USER_REFRESH_TOKEN_COOKIE)?.value ?? null;
}
