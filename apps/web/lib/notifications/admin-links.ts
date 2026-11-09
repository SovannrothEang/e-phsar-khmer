import type { BackendNotification } from "@/types/notification";

/** The two moderation queues the bell shortcuts into. */
export const ADMIN_REPORT_QUEUES = {
  users: "/wanderer/dashboard/report/users",
  listings: "/wanderer/dashboard/report/posts",
} as const;

export const ADMIN_NOTIFICATIONS_PAGE = "/wanderer/dashboard/notifications";

/**
 * Where a staff notification lands in the dashboard. `report.created` carries
 * the target type it was filed against; the threshold alert mentions the
 * Users page in its own body; a post-publication edit belongs in the listing
 * queue. Everything else (security notices, payment rows) has no admin
 * destination and stays read-only in the feed.
 */
export function adminNotificationHref(
  notification: Pick<BackendNotification, "type" | "data">,
): string | null {
  switch (notification.type) {
    case "report.created":
      if (notification.data.targetType === "user") {
        return ADMIN_REPORT_QUEUES.users;
      }
      if (notification.data.targetType === "listing") {
        return ADMIN_REPORT_QUEUES.listings;
      }
      return null;
    case "report.threshold":
      return "/wanderer/dashboard/users";
    case "listing.edited":
      return "/wanderer/dashboard/listings";
    default:
      return null;
  }
}
