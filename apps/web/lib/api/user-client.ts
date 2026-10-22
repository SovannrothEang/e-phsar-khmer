import "server-only";
import {
  clearUserSession,
  getUserAccessToken,
  getUserDeviceId,
  getUserRefreshToken,
  setUserSession,
} from "@/lib/auth/session";
import { API_URL, ApiError, type PaginationMeta } from "@/lib/api/client";

/**
 * USER-SCOPED server fetch — the customer-facing twin of `serverFetch`.
 *
 * `serverFetch` (lib/api/client.ts) reads the `admin_access_token` cookie and
 * exists solely for the `/wanderer/*` admin dashboard. Calling it from a
 * user-facing surface would authenticate every visitor's request as the
 * logged-in ADMIN — on chat that means one customer reading every other
 * customer's private messages. Anything rendered under `app/[locale]/*` MUST
 * go through `userServerFetch`, which reads `user_access_token` instead.
 *
 * Behaviourally identical to `serverFetch` otherwise: injects the bearer
 * token, transparently refreshes once on 401, unwraps the
 * `{ success, data, meta }` envelope and throws {@link ApiError} on failure.
 *
 * One deliberate difference: the `meta` type is a generic parameter. Chat
 * pagination rides in `meta` and carries fields `PaginationMeta` does not
 * have (`latestCursor`, `peerLastReadAt`), so callers narrow it themselves
 * rather than losing those fields to the base type.
 */

export type { PaginationMeta };
export { ApiError };

interface Envelope<T, M> {
  success: boolean;
  data?: T;
  meta?: M;
  error?: { code: string; message: string; details?: unknown };
}

export interface UserApiResult<T, M = PaginationMeta> {
  data: T;
  meta?: M;
}

function rawFetch(
  path: string,
  init: RequestInit | undefined,
  token: string | null,
): Promise<Response> {
  // For FormData bodies, let the runtime set the multipart boundary — don't
  // force Content-Type or the upload arrives with no boundary and fails.
  const isFormData = init?.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
}

/**
 * Exchange the user refresh token for a fresh access token. Returns null when
 * there is no refresh token or the backend rejects it — the caller then fails
 * the request and clears the session.
 */
async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getUserRefreshToken();
  if (!refreshToken) return null;
  // A legacy (no-`sid`) refresh token is bound to its device row on this
  // hop; a revoked row answers 401 instead of minting a new session.
  const deviceId = await getUserDeviceId();

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(deviceId ? { "x-device-id": deviceId } : {}),
    },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<
    { accessToken: string; refreshToken?: string },
    never
  > | null;

  if (!res.ok || !body?.success || !body.data) return null;

  try {
    // Cookie writes only succeed inside a Server Action / Route Handler;
    // during an RSC render they throw because cookies() is read-only there.
    // Swallow it — the retried request below still uses the fresh token, and
    // the rotated pair persists on the next mutation.
    await setUserSession({
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken ?? refreshToken,
    });
  } catch {
    /* read-only context (RSC render) — token persists on next mutation */
  }
  return body.data.accessToken;
}

export async function userServerFetch<T, M = PaginationMeta>(
  path: string,
  init?: RequestInit,
): Promise<UserApiResult<T, M>> {
  let token = await getUserAccessToken();
  let res = await rawFetch(path, init, token);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = refreshed;
      res = await rawFetch(path, init, token);
    }
  }

  const body = (await res.json().catch(() => null)) as Envelope<T, M> | null;

  if (!res.ok || !body?.success) {
    if (res.status === 401) {
      try {
        await clearUserSession();
      } catch {
        /* read-only context */
      }
    }
    throw new ApiError(
      res.status,
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? res.statusText,
      body?.error?.details,
    );
  }

  return { data: body.data as T, meta: body.meta };
}

/** True when the visitor has a user session cookie at all. */
export async function hasUserSession(): Promise<boolean> {
  return (await getUserAccessToken()) !== null;
}
