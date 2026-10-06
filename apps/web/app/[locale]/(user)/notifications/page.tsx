import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getNotifications } from "@/actions/notifications";
import Notifications from "@/components/home/Notifications";
import type { NotificationPage } from "@/types/notification";

/**
 * A signed-in surface: an anonymous visitor is sent to the login page, the same
 * gate `/post` and `/me` use — the feed has no visitor view, and without the
 * gate the fetch below would just 401.
 *
 * Page one is fetched here (server-side, with the user's cookie) and handed to
 * the client component; the menus mutate through the server actions.
 */
export default async function NotificationsPage() {
  const me = await getCurrentUser();
  const locale = await getLocale();
  if (!me) return redirect({ href: "/login", locale });

  let page: NotificationPage = { items: [], hasMore: false };
  try {
    page = await getNotifications();
  } catch {
    // Backend unreachable or the session was rejected mid-flight — render the
    // empty shell rather than taking the page to the error boundary.
  }

  return <Notifications initial={page.items} initialHasMore={page.hasMore} />;
}
