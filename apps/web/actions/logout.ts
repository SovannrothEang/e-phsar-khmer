"use server";

import { clearAdminSession, clearUserSession } from "@/lib/auth/session";
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
  await clearUserSession();
  // User surface lives under /[locale] — a bare redirect("/login") 404s.
  const locale = await getLocale();
  i18nRedirect({ href: "/login", locale });
}
