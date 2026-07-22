import { cookies } from "next/headers"

export const ACCESS_TOKEN_COOKIE = "admin_access_token"
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token"

const THIRTY_DAYS = 60 * 60 * 24 * 30

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: THIRTY_DAYS,
  }
}

/** Persist tokens in httpOnly cookies. Only valid inside a Server Action or Route Handler. */
export async function setSession(tokens: SessionTokens): Promise<void> {
  const store = await cookies()
  store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions())
  store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions())
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(ACCESS_TOKEN_COOKIE)
  store.delete(REFRESH_TOKEN_COOKIE)
}

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

export async function getRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value ?? null
}
