import "server-only";
import {
  clearAdminSession,
  clearUserSession,
  getAdminAccessToken,
  getAdminRefreshToken,
  getUserAccessToken,
  getUserDeviceId,
  getUserRefreshToken,
  setAdminSession,
  setUserSession,
} from "@/lib/auth/session";

export const API_URL = process.env.API_URL ?? "http://localhost:3000/api/v1";

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  total?: number;
  page?: number;
  pageSize?: number;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  error?: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function rawFetch(
  path: string,
  init: RequestInit | undefined,
  token: string | null,
): Promise<Response> {
  // For FormData bodies, let the browser set the multipart boundary — don't
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

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getAdminRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Envelope<{
    accessToken: string;
    refreshToken?: string;
  }> | null;

  if (!res.ok || !body?.success || !body.data) return null;

  try {
    // Cookie writes only succeed inside a Server Action / Route Handler; during
    // an RSC render this throws — swallow it so the retried request still works.
    await setAdminSession({
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken ?? refreshToken,
    });
  } catch {
    /* read-only context (RSC render) — token persists on next mutation */
  }
  return body.data.accessToken;
}

export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * Server-side fetch against the backend API. Injects the httpOnly access token,
 * transparently refreshes once on 401, unwraps the `{success,data,meta}`
 * envelope, and throws {@link ApiError} on failure.
 */
export async function serverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let token = await getAdminAccessToken();
  let res = await rawFetch(path, init, token);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = refreshed;
      res = await rawFetch(path, init, token);
    }
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok || !body?.success) {
    if (res.status === 401) {
      try {
        await clearAdminSession();
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

async function tryUserRefresh(): Promise<string | null> {
  const refreshToken = await getUserRefreshToken();
  if (!refreshToken) return null;
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
  const body = (await res.json().catch(() => null)) as Envelope<{
    accessToken: string;
    refreshToken?: string;
  }> | null;

  if (!res.ok || !body?.success || !body.data) return null;

  try {
    // Cookie writes only succeed inside a Server Action / Route Handler; during
    // an RSC render this throws — swallow it so the retried request still works.
    await setUserSession({
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken ?? refreshToken,
    });
  } catch {
    /* read-only context (RSC render) — token persists on next mutation */
  }
  return body.data.accessToken;
}

/**
 * User-side twin of {@link serverFetch}: injects the USER session's httpOnly
 * access token, transparently refreshes once on 401, unwraps the
 * `{success,data,meta}` envelope, and throws {@link ApiError} on failure.
 */
export async function userServerFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let token = await getUserAccessToken();
  let res = await rawFetch(path, init, token);

  if (res.status === 401) {
    const refreshed = await tryUserRefresh();
    if (refreshed) {
      token = refreshed;
      res = await rawFetch(path, init, token);
    }
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;

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
