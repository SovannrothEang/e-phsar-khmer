import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";

/**
 * Admin UI locale cookie. The /wanderer/* surface is not locale-prefixed (no
 * /[locale] segment), so the admin locale is carried by this cookie instead.
 * Seeded at login from the user's `preferredLanguage` and updated in-session
 * by the in-dashboard LocaleSwitcher (which also PATCHes /users/me).
 */
export const ADMIN_LOCALE_COOKIE = "admin_locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Read and validate the admin locale cookie; fall back to the default locale. */
export async function resolveAdminLocale(): Promise<string> {
  const store = await cookies();
  const candidate = store.get(ADMIN_LOCALE_COOKIE)?.value;
  if (candidate && (routing.locales as readonly string[]).includes(candidate)) {
    return candidate;
  }
  return routing.defaultLocale;
}

/** Persist the admin locale for the session. Server Action / Route Handler only. */
export async function setAdminLocale(locale: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Clear the admin locale cookie (used on logout). */
export async function clearAdminLocale(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_LOCALE_COOKIE);
}
