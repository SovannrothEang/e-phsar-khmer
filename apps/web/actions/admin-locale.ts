"use server";

import { serverFetch, ApiError } from "@/lib/api/client";
import { setAdminLocale } from "@/lib/auth/admin-locale";
import { routing } from "@/i18n/routing";

const SUPPORTED_LOCALES = routing.locales as readonly string[];

/**
 * Update the admin UI locale for the current session: sets the `admin_locale`
 * cookie (immediate effect via the wanderer root layout's NextIntlClientProvider)
 * AND persists the choice to `users.preferredLanguage` via PATCH /users/me so it
 * survives across sessions/devices.
 */
export async function updateAdminLocale(locale: string) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return { success: false as const, error: "Unsupported locale" };
  }

  await setAdminLocale(locale);

  try {
    await serverFetch("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ preferredLanguage: locale }),
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Cookie is already set — UI switches immediately. The PATCH failure only
    // means the choice won't persist to the next login. Surface a soft warning.
    const message =
      err instanceof ApiError
        ? err.message
        : "Failed to save language preference";
    return { success: false as const, error: message };
  }

  return { success: true as const };
}
