"use server";

/**
 * Notifications for the signed-in ADMIN. Every call goes through `serverFetch`
 * (the `admin_access_token` cookie), never `userServerFetch` — the dashboard
 * must read the staff member's own rows, not the storefront visitor's session.
 * The backend scopes each route by the token, so no user id is ever passed.
 */

import { ApiError, serverFetch } from "@/lib/api/client";
import type {
  BackendNotification,
  NotificationPage,
} from "@/types/notification";

/** Mutations report `{ success, error? }`; queries return the data directly. */
export interface AdminNotificationActionResult {
  success: boolean;
  error?: string;
}

function toFailure(err: unknown): AdminNotificationActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: "Network error" };
}

/** One page of the admin's own feed, newest first. */
export async function getAdminNotifications(
  page = 1,
  pageSize = 20,
): Promise<NotificationPage> {
  const { data, meta } = await serverFetch<BackendNotification[]>(
    `/notifications?page=${page}&pageSize=${pageSize}`,
  );
  return { items: data ?? [], hasMore: meta?.hasMore ?? false };
}

/**
 * Unread count for the dashboard bell. `null` means the admin session was
 * rejected: the badge hides and its poll stops, mirroring the storefront
 * badge instead of throwing on every tick.
 */
export async function getAdminUnreadNotificationCount(): Promise<
  number | null
> {
  try {
    const { data } = await serverFetch<{ total: number }>(
      "/notifications/unread-count",
    );
    return data?.total ?? 0;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function markAdminNotificationRead(
  id: string,
): Promise<AdminNotificationActionResult> {
  try {
    await serverFetch(`/notifications/${id}/read`, { method: "PATCH" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function markAllAdminNotificationsRead(): Promise<AdminNotificationActionResult> {
  try {
    await serverFetch("/notifications/read-all", { method: "PATCH" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function deleteAdminNotification(
  id: string,
): Promise<AdminNotificationActionResult> {
  try {
    await serverFetch(`/notifications/${id}`, { method: "DELETE" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function deleteAllAdminNotifications(): Promise<AdminNotificationActionResult> {
  try {
    await serverFetch("/notifications", { method: "DELETE" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}
