import type { BackendNotification } from "@/types/notification";

/** The two moderation queues the bell shortcuts into. */
export const ADMIN_REPORT_QUEUES = {
  users: "/wanderer/dashboard/report/users",
  listings: "/wanderer/dashboard/report/posts",
} as const;

export const ADMIN_NOTIFICATIONS_PAGE = "/wanderer/dashboard/notifications";

/**
 * Where a staff notification lands in the dashboard. `report.created` carries
 * the target type it was filed against; the threshold alert carries the
 * target's identity so Open lands on a filtered Users page; a post-publication
 * edit belongs in the listing queue. Everything else (security notices,
 * payment rows) has no admin destination and stays read-only in the feed.
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
    case "report.threshold": {
      // The threshold notice carries the target's identity so "Open" lands on
      // a filtered Users page instead of the unfiltered list.
      const username =
        typeof notification.data.targetUsername === "string" &&
        notification.data.targetUsername.length > 0
          ? notification.data.targetUsername
          : null;
      const name =
        typeof notification.data.targetName === "string" &&
        notification.data.targetName.length > 0
          ? notification.data.targetName
          : null;
      const status =
        notification.data.targetStatus === "active" ||
        notification.data.targetStatus === "suspended" ||
        notification.data.targetStatus === "deleted"
          ? notification.data.targetStatus
          : null;
      const params = new URLSearchParams();
      if (username) params.set("q", username);
      else if (name) params.set("q", name);
      if (status) params.set("status", status);
      const query = params.toString();
      return `/wanderer/dashboard/users${query ? `?${query}` : ""}`;
    }
    case "listing.edited":
      return "/wanderer/dashboard/listings";
    default:
      return null;
  }
}
