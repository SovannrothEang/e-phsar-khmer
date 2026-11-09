import "server-only";
import { cache } from "react";
import { getAdminAccessToken, getAdminRefreshToken } from "@/lib/auth/session";
import { isJwtExpired } from "@/lib/auth/jwt-exp";
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
 *
 * A half-dead pair is NOT repaired here even though `serverFetch` can refresh
 * in flight: this runs during a render, where Next forbids cookie writes, so a
 * rotated token could never be persisted and every render would redo the
 * refresh. Worse, a missing access token used to mean an unauthenticated
 * `GET /users/me` on every single render — a permanent stream of 401s that
 * nothing could clear. So: no usable access token, no request. `proxy.ts`
 * deletes the leftover cookies so the state heals instead of sticking.
 */
export const getModeratorSession = cache(
  async (): Promise<ModeratorSession | null> => {
    const [accessToken, refreshToken] = [
      await getAdminAccessToken(),
      await getAdminRefreshToken(),
    ];
    // Anonymous fast-path: most public renders carry no admin cookies at all.
    if (!accessToken && !refreshToken) return null;

    // A pair that cannot authenticate is treated as absent. Without this the
    // stale-cookie case fires one doomed request per render, forever.
    if (!accessToken || !refreshToken) return null;
    if (isJwtExpired(accessToken)) return null;

    try {
      const { data } = await serverFetch<BackendUser>("/users/me");
      if (data.role !== "admin") return null;
      return { id: data.id, username: data.username };
    } catch {
      return null;
    }
  },
);
