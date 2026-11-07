"use server";

import { cookies, headers as nextHeaders } from "next/headers";
import { API_URL } from "@/lib/api/client";
import {
  getUserAccessToken,
  setAdminSession,
  setUserDeviceId,
  setUserSession,
} from "@/lib/auth/session";
import { setAdminLocale } from "@/lib/auth/admin-locale";
import { routing } from "@/i18n/routing";
import type { BackendUser } from "@/lib/api/adapters";
import type { DeviceIdentity } from "@/lib/device";
import {
  SOCIAL_OAUTH_STATE_PATTERN,
  SOCIAL_STATE_PATTERN,
  type LinkedAuthProvider,
  type SocialCompleteResult,
  type SocialProvider,
  type SocialStartResult,
  type SocialTarget,
  type SocialUnlinkResult,
} from "@/lib/auth/social";

/**
 * Bound to the browser that STARTED the flow, and to the exact flow: the value
 * is `<target>:<state>` where `state` is the single-use nonce the backend
 * minted for this round trip (it consumes the nonce on the callback). A
 * crafted callback URL carrying someone else's Supabase token cannot complete,
 * because this browser's cookie holds a different flow's nonce.
 */
const SOCIAL_PENDING_COOKIE = "social_oauth_pending";
const SOCIAL_PENDING_TTL = 60 * 10;

/**
 * The linking flow has its own cookie and nonce: the value is
 * `<provider>:<nonce>` and the same nonce rides in the callback path, so a
 * callback URL is usable exactly once and only by the browser that started it.
 */
const SOCIAL_LINK_PENDING_COOKIE = "social_link_pending";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: BackendUser;
  newDevice?: boolean;
}

function isProvider(value: string): value is SocialProvider {
  return value === "google" || value === "facebook";
}

function isTarget(value: string): value is SocialTarget {
  return value === "user" || value === "admin";
}

/**
 * The browser-visible origin of this request. Server actions are POSTed to
 * the page they were rendered on, so the host header is the origin that will
 * also receive the OAuth redirect (and hold the session cookie).
 */
async function requestOrigin(): Promise<string> {
  const incoming = await nextHeaders();
  const forwardedHost = incoming.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || incoming.get("host");
  if (!host) return "";

  const forwardedProto = incoming
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const isLocal =
    host.startsWith("localhost") ||
    host.includes(".localhost") ||
    host.startsWith("127.") ||
    host.startsWith("[::1]");
  const proto = forwardedProto || (isLocal ? "http" : "https");

  return `${proto}://${host}`;
}

/** The admin cookie must be written on the host that serves `/wanderer/*`. */
function adminOrigin(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_ADMIN_URL;
  if (!configured) return requestOrigin;
  try {
    return new URL(configured).origin;
  } catch {
    return requestOrigin;
  }
}

function resolveLocale(locale?: string): string {
  return locale && (routing.locales as readonly string[]).includes(locale)
    ? locale
    : routing.defaultLocale;
}

/** Ask the backend for the provider's authorize URL and sanity-check it. */
async function fetchAuthorizeUrl(
  provider: SocialProvider,
  redirectTo: string,
): Promise<SocialStartResult> {
  const res = await fetch(
    `${API_URL}/auth/social/${provider}/url?redirectTo=${encodeURIComponent(redirectTo)}`,
    { cache: "no-store" },
  );
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { url?: string; state?: string };
    error?: { code?: string; message?: string };
  } | null;

  const url = body?.data?.url;
  const state = body?.data?.state;
  if (!res.ok || !body?.success || !url || !state) {
    return {
      success: false,
      error: body?.error?.message ?? "Could not start sign-in",
    };
  }

  // Never hand a non-http(s) URL to window.location.
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return { success: false, error: "Could not start sign-in" };
  } catch {
    return { success: false, error: "Could not start sign-in" };
  }
  // A state we cannot echo back would fail the callback for a reason the
  // visitor cannot act on, so refuse the flow here instead.
  if (!SOCIAL_OAUTH_STATE_PATTERN.test(state))
    return { success: false, error: "Could not start sign-in" };

  return { success: true, url, state };
}

export async function startSocialLogin(
  provider: SocialProvider,
  target: SocialTarget,
  locale?: string,
): Promise<SocialStartResult> {
  if (!isProvider(provider) || !isTarget(target))
    return { success: false, error: "Unsupported sign-in provider" };

  const origin = await requestOrigin();
  if (!origin) return { success: false, error: "Could not start sign-in" };

  let redirectTo: string;
  if (target === "admin") {
    redirectTo = `${adminOrigin(origin)}/wanderer/auth/callback/${provider}`;
  } else {
    redirectTo = `${origin}/${resolveLocale(locale)}/auth/callback/${provider}`;
  }

  // The cookie is written only once the backend has minted this flow's state,
  // so a failed start leaves nothing behind to complete later.
  const result = await fetchAuthorizeUrl(provider, redirectTo);
  if (!result.success) return result;

  const store = await cookies();
  store.set(SOCIAL_PENDING_COOKIE, `${target}:${result.state}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SOCIAL_PENDING_TTL,
  });

  return result;
}

export async function completeSocialLogin(input: {
  provider: SocialProvider;
  target: SocialTarget;
  accessToken: string;
  /** The locale segment the flow started from; the user lands back in it. */
  locale?: string;
  device?: DeviceIdentity | null;
}): Promise<SocialCompleteResult> {
  const { provider, target, accessToken, locale, device } = input;

  if (!isProvider(provider) || !isTarget(target))
    return { success: false, error: "Unsupported sign-in provider" };
  if (
    typeof accessToken !== "string" ||
    accessToken.length < 20 ||
    accessToken.length > 8192
  ) {
    return { success: false, error: "Invalid sign-in token" };
  }

  const store = await cookies();
  const pending = store.get(SOCIAL_PENDING_COOKIE)?.value;
  store.delete(SOCIAL_PENDING_COOKIE);
  const [pendingTarget, pendingState] = (pending ?? "").split(":");
  if (
    pendingTarget !== target ||
    !SOCIAL_OAUTH_STATE_PATTERN.test(pendingState ?? "")
  ) {
    return {
      success: false,
      error: "This sign-in did not start in this browser. Please try again.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // The user flow records a login device exactly like `actions/login.ts`;
  // the admin flow matches `actions/admin-login.ts`, which sends none.
  if (target === "user" && device) {
    headers["x-device-id"] = device.id;
    headers["x-device-name"] = device.name;
    const incoming = await nextHeaders();
    headers["x-device-info"] = encodeURIComponent(
      JSON.stringify({
        type: "browser",
        clientVersion: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
        userAgent: incoming.get("user-agent") ?? undefined,
      }),
    );
  }

  const res = await fetch(`${API_URL}/auth/social/callback`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider,
      accessToken,
      state: pendingState,
      ...(target === "admin" ? { mode: "admin" } : {}),
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: AuthResponse;
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok || !body?.success || !body.data) {
    const message = body?.error?.message;
    const code = body?.error?.code;
    return {
      success: false,
      error:
        target === "admin"
          ? "This account is not authorized for the admin dashboard"
          : code === "EMAIL_LINK_REQUIRED"
            ? "An account already uses this email. Sign in with your existing method, then link this provider from Settings."
            : message === "SOCIAL_EMAIL_UNVERIFIED"
              ? "The email on that account is not verified."
              : message === "SOCIAL_EMAIL_REQUIRED"
                ? "That provider did not return an email address."
                : (message ?? "Sign-in failed"),
    };
  }

  const { user, accessToken: sessionToken, refreshToken } = body.data;

  if (target === "admin") {
    // Defense in depth: the backend's admin mode already refuses a non-staff
    // account, but never write admin cookies without checking again.
    if (user.role !== "admin" && user.role !== "super_admin") {
      return {
        success: false,
        error: "This account is not authorized for the admin dashboard",
      };
    }

    await setAdminSession({ accessToken: sessionToken, refreshToken });
    const locale = (routing.locales as readonly string[]).includes(
      user.preferredLanguage,
    )
      ? user.preferredLanguage
      : routing.defaultLocale;
    await setAdminLocale(locale);
    return { success: true, redirectTo: "/wanderer/dashboard" };
  }

  await setUserSession({ accessToken: sessionToken, refreshToken });
  if (device) {
    try {
      await setUserDeviceId(device.id);
    } catch {
      /* the client-side mirror already wrote it */
    }
  }

  return { success: true, redirectTo: `/${resolveLocale(locale)}/me` };
}

/**
 * Start the account-linking flow. Requires a signed-in user; the nonce in the
 * pending cookie is echoed in the callback path so a callback URL is usable
 * exactly once and only by the browser that started it.
 */
export async function startSocialLink(
  provider: SocialProvider,
  locale?: string,
): Promise<SocialStartResult> {
  if (!isProvider(provider))
    return { success: false, error: "Unsupported sign-in provider" };

  const userToken = await getUserAccessToken();
  if (!userToken) return { success: false, error: "Please sign in again." };

  const origin = await requestOrigin();
  if (!origin) return { success: false, error: "Could not start sign-in" };

  const nonce = crypto.randomUUID();
  const redirectTo = `${origin}/${resolveLocale(locale)}/auth/link/${provider}/${nonce}`;

  const store = await cookies();
  store.set(SOCIAL_LINK_PENDING_COOKIE, `${provider}:${nonce}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SOCIAL_PENDING_TTL,
  });

  const result = await fetchAuthorizeUrl(provider, redirectTo);
  if (!result.success) store.delete(SOCIAL_LINK_PENDING_COOKIE);
  return result;
}

/**
 * Finish the linking flow: the pending cookie must match the nonce in the
 * callback path exactly, then the provider token is attached to the signed-in
 * account through the JWT-protected backend endpoint. No session cookies are
 * written — this is not a login.
 */
export async function completeSocialLink(input: {
  provider: SocialProvider;
  accessToken: string;
  nonce: string;
  locale?: string;
}): Promise<SocialCompleteResult> {
  const { provider, accessToken, nonce, locale } = input;

  if (!isProvider(provider))
    return { success: false, error: "Unsupported sign-in provider" };
  if (
    typeof accessToken !== "string" ||
    accessToken.length < 20 ||
    accessToken.length > 8192
  )
    return { success: false, error: "Invalid sign-in token" };
  if (!SOCIAL_STATE_PATTERN.test(nonce))
    return { success: false, error: "Invalid sign-in request" };

  const store = await cookies();
  const pending = store.get(SOCIAL_LINK_PENDING_COOKIE)?.value;
  if (pending !== `${provider}:${nonce}`) {
    // Do not delete on mismatch: a wrong-nonce visit must not cancel a live
    // flow the visitor actually started.
    return {
      success: false,
      error: "This connection did not start in this browser. Please try again.",
    };
  }
  store.delete(SOCIAL_LINK_PENDING_COOKIE);

  const userToken = await getUserAccessToken();
  if (!userToken) return { success: false, error: "Please sign in again." };

  const res = await fetch(`${API_URL}/auth/social/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ provider, accessToken }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok || !body?.success) {
    const code = body?.error?.code;
    return {
      success: false,
      error:
        code === "PROVIDER_ACCOUNT_ALREADY_LINKED"
          ? "That account is already connected to another user."
          : code === "PROVIDER_ALREADY_LINKED"
            ? "You already have a different account connected for this provider."
            : (body?.error?.message ?? "Could not connect that account."),
    };
  }

  return { success: true, redirectTo: `/${resolveLocale(locale)}/settings` };
}

/** Remove a provider from the signed-in account. */
export async function unlinkSocialProvider(
  provider: LinkedAuthProvider,
): Promise<SocialUnlinkResult> {
  if (
    provider !== "google" &&
    provider !== "facebook" &&
    provider !== "telegram"
  )
    return { success: false, error: "Unsupported provider" };

  const userToken = await getUserAccessToken();
  if (!userToken)
    return {
      success: false,
      code: "UNAUTHORIZED",
      error: "Please sign in again.",
    };

  const res = await fetch(`${API_URL}/auth/social/${provider}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok || !body?.success) {
    const code = body?.error?.code;
    return {
      success: false,
      code,
      error:
        code === "LAST_LOGIN_METHOD"
          ? "This is your only way to sign in. Add a phone number first."
          : (body?.error?.message ?? "Could not remove that connection."),
    };
  }

  return { success: true };
}
