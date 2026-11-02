/**
 * Query keys for the customer notifications surface. Namespaced under
 * `["user", …]` like chat, so the admin dashboard's `["admin", …]` caches can
 * never collide inside the shared QueryClient.
 */
export const notificationKeys = {
  all: ["user", "notifications"] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
  /** The navbar bell panel's newest-N list. */
  recent: () => [...notificationKeys.all, "recent"] as const,
};
