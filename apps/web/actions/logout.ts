"use server";

import { clearAdminSession } from "@/lib/auth/session";
import { clearAdminLocale } from "@/lib/auth/admin-locale";
import { redirect } from "next/navigation";

/**
 * Admin logout: clears the session token cookies and the admin_locale cookie,
 * then redirects to the admin login page. Called from the NavUser dropdown.
 */
export async function adminLogout() {
  await clearAdminSession();
  await clearAdminLocale();
  redirect("/wanderer/login");
}
