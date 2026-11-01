import { tokenStore } from "@/lib/auth/token-store";
import { API_URL, normalizeApiLocale, type ApiLocale } from "@/lib/api/config";
import { getDeviceHeaders } from "@/lib/api/device";

export interface ApiMeta {
  nextCursor?: string | null;
  total?: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  meta?: ApiMeta;
  error?: { code?: string; message?: string; details?: unknown };
}

export interface ApiFetchOptions extends Omit<RequestInit, "body" | "headers"> {
  /** Serialized as JSON. */
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Attach the stored access token and refresh on 401. Auth endpoints must
   * pass `false` — a wrong password is also a 401, and a refresh/retry would
   * otherwise swallow the real error.
   */
  auth?: boolean;
  /** Overrides the language used for this call; defaults to the app locale. */
  locale?: ApiLocale;
  /** Internal: the retried request must not refresh again. */
  skipRefresh?: boolean;
}

let apiLocale: ApiLocale = "en";

/** Called by the language provider so every request carries the right `Accept-Language`. */
export function setApiLocale(locale: string): void {
  apiLocale = normalizeApiLocale(locale);
}

let sessionExpiredHandler: (() => void) | null = null;

/** Registered by the auth provider: a failed refresh means the session is gone. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const session = await tokenStore.getSession();
      if (!session) return false;

      try {
        const device = await getDeviceHeaders();
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...device },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        const body = (await res.json().catch(() => null)) as Envelope<{
          accessToken?: string;
          refreshToken?: string;
        }> | null;

        if (
          !res.ok ||
          !body?.success ||
          !body.data?.accessToken ||
          !body.data.refreshToken
        ) {
          return false;
        }

        await tokenStore.setSession({
          accessToken: body.data.accessToken,
          refreshToken: body.data.refreshToken,
        });
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/**
 * One fetch for the whole app: unwraps `{ success, data, meta }`, turns
 * `{ success: false, error }` into `ApiError`, attaches the bearer token and
 * refreshes it once on 401.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<{ data: T; meta?: ApiMeta }> {
  const {
    body,
    headers,
    auth = true,
    locale,
    skipRefresh = false,
    ...init
  } = options;

  const session = auth ? await tokenStore.getSession() : null;
  // Authenticated calls carry the device identity too: `/auth/devices` uses it
  // to mark the current row (`isCurrent`) and session revocation matches it.
  const device = session ? await getDeviceHeaders().catch(() => null) : null;
  const url = path.startsWith("http")
    ? path
    : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  // Multipart uploads (avatar/cover) must let the platform set the boundary;
  // everything else is JSON.
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const request = (accessToken?: string | null) =>
    fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Accept-Language": locale ?? apiLocale,
        ...(device ?? {}),
        ...(body !== undefined && !isFormData
          ? { "Content-Type": "application/json" }
          : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    });

  let res = await request(session?.accessToken);

  if (res.status === 401 && auth && session && !skipRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const next = await tokenStore.getSession();
      res = await request(next?.accessToken);
    } else {
      await tokenStore.clearSession();
      sessionExpiredHandler?.();
    }
  }

  const parsed = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok || !parsed || parsed.success === false) {
    throw new ApiError(
      res.status,
      parsed?.error?.code ?? String(res.status),
      parsed?.error?.message ?? `Request failed (${res.status})`,
      parsed?.error?.details,
    );
  }

  return { data: parsed.data as T, meta: parsed.meta };
}
