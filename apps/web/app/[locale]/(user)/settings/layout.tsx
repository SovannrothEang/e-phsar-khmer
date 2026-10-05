import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getSettingsUser } from "@/lib/auth/current-user";

/**
 * Every /settings route needs a signed-in user — the pages read their own
 * profile. Same gate as `me/layout.tsx`: resolve the session first, then
 * bounce to login with the locale prefix intact.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getSettingsUser();
  const locale = await getLocale();
  if (!me) return redirect({ href: "/login", locale });

  return <>{children}</>;
}
