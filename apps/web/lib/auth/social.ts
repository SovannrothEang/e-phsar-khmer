/**
 * Shared shapes for the Supabase social-login flow.
 *
 * These live outside `actions/social.ts` on purpose: a `"use server"` module
 * may only export async functions, so types and constants belong in a plain
 * module both the server action and the client callback component can import.
 */

export type SocialProvider = "google" | "facebook";

/** Providers the settings surface can display / remove. */
export type LinkedAuthProvider = SocialProvider | "telegram";

/** Which cookie pair a completed social login writes. */
export type SocialTarget = "user" | "admin";

/** Which callback page completes the flow. */
export type SocialCallbackMode = SocialTarget | "link";

export type SocialStartResult =
  | { success: true; url: string; state: string }
  | { success: false; error: string };

export type SocialCompleteResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export type SocialUnlinkResult =
  | { success: true }
  | { success: false; code?: string; error: string };

/** Popup window name/features shared by the user and admin login forms. */
export const SOCIAL_POPUP_NAME = "phsarkhmer-social-login";
export const SOCIAL_LINK_POPUP_NAME = "phsarkhmer-social-link";
export const SOCIAL_POPUP_FEATURES = "popup=yes,width=520,height=640";

/** How often the opener checks whether the visitor closed the popup. */
export const SOCIAL_CLOSE_POLL_MS = 500;

/** The per-flow nonce echoed in the link callback path. */
export const SOCIAL_STATE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The `state` the backend mints per login flow (24 random bytes, base64url).
 * Shaped differently from the link nonce above because the two are produced by
 * different sides: the link nonce is a UUID from this app, this one comes from
 * `SocialStateService` and is consumed by the backend on the callback.
 */
export const SOCIAL_OAUTH_STATE_PATTERN = /^[A-Za-z0-9_-]{32}$/;
