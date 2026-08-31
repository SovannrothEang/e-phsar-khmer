import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function PublishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  const locale = await getLocale();
  if (!me) return redirect({ href: "/login", locale });

  return <>{children}</>;
}
