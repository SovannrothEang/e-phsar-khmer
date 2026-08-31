import "server-only";
import { getUserAccessToken, getUserRefreshToken } from "@/lib/auth/session";
import { userServerFetch } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";

/** Minimal serializable user shape passed to client chrome (NavBar etc.). */
export interface SessionUser {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryPhone: string | null;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  createdAt: string;
}

/**
 * The logged-in user for the current request, or null for a visitor.
 * Fail-soft on purpose: a down backend or an expired session renders the
 * visitor chrome — the layout must never crash on auth.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // Anonymous fast-path: with no tokens at all, skip the doomed /auth/me
  // round trip (every visitor page render goes through here).
  const [accessToken, refreshToken] = [
    await getUserAccessToken(),
    await getUserRefreshToken(),
  ];
  if (!accessToken && !refreshToken) return null;

  try {
    const { data } = await userServerFetch<BackendUser>("/auth/me");
    return {
      id: data.id,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      primaryPhone: data.primaryPhone,
      profilePhotoUrl: data.profilePhotoUrl,
      coverPhotoUrl: data.coverPhotoUrl,
      createdAt: data.createdAt,
    };
  } catch {
    return null;
  }
}
