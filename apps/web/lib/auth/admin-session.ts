import "server-only";
import { cache } from "react";
import { getAdminAccessToken, getAdminRefreshToken } from "@/lib/auth/session";
import { serverFetch } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/adapters";

/** The dashboard session as the public marketplace is allowed to see it. */
export interface ModeratorSession {
  id: string;
  username: string | null;
}

/**
 * Detects an active `admin` dashboard session on a public page.
 *
 * The dashboard and the public site use separate cookie pairs on purpose
 * (`admin_access_token` vs `user_access_token`). Reading the admin pair here
 * is what lets an admin moderate a listing from the public three-dot menu
 * without a second, user-side account.
 *
 * `super_admin` is deliberately excluded: the backend's admin-listings
 * controller is `@Roles('admin')` (the 2026-10-26 tier split), so a
 * super_admin would only get a 403 from the action.
 *
 * Cached per request — the layout is the only caller. Fail-soft: an expired
 * or revoked admin session must render the visitor page, never crash it.
 * `serverFetch` refreshes an expired access token in-flight (the new cookies
 * persist on the next server action), so staff mode survives a stale token.
 */
export const getModeratorSession = cache(
  async (): Promise<ModeratorSession | null> => {
    const [accessToken, refreshToken] = [
      await getAdminAccessToken(),
      await getAdminRefreshToken(),
    ];
    // Anonymous fast-path: most public renders carry no admin cookies at all.
    if (!accessToken && !refreshToken) return null;

    try {
      const { data } = await serverFetch<BackendUser>("/users/me");
      if (data.role !== "admin") return null;
      return { id: data.id, username: data.username };
    } catch {
      return null;
    }
  },
);
