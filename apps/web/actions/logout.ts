"use server";

import { clearAdminSession, clearUserSession } from "@/lib/auth/session";
import { userServerFetch } from "@/lib/api/user-client";
import { clearAdminLocale } from "@/lib/auth/admin-locale";
import { redirect } from "next/navigation";
import { redirect as i18nRedirect } from "@/i18n/routing";
import { getLocale } from "next-intl/server";

/**
 * Admin logout: clears the session token cookies and the admin_locale cookie,
 * then redirects to the admin login page. Called from the NavUser dropdown.
 */
export async function adminLogout() {
  await clearAdminSession();
  await clearAdminLocale();
  redirect("/wanderer/login");
}

/**
 * User logout: clears the user session cookies, then redirects to the user
 * login page. Called from the NavBar SocialBar dropdown.
 */
export async function userLogout() {
  // Revoke the device row first (best effort): the settings page treats an
  // active row as a signed-in session, so a local-only sign-out would leave
  // this browser listed as active.
  try {
    await userServerFetch("/auth/logout", { method: "POST" });
  } catch {
    /* API down or already revoked — clear the cookies regardless */
  }
  await clearUserSession();
  // User surface lives under /[locale] — a bare redirect("/login") 404s.
  const locale = await getLocale();
  i18nRedirect({ href: "/login", locale });
}
