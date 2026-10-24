import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";

/**
 * The plan screen lives under the Subscriptions tab now. This route stays so
 * links already shared keep working.
 */
export default async function MembershipRedirect() {
  return redirect({ href: "/me/subscriptions", locale: await getLocale() });
}
