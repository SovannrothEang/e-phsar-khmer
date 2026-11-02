"use server";

/**
 * Notifications for the signed-in USER. Like `actions/chat.ts`, every call goes
 * through `userServerFetch` (the `user_access_token` cookie) and never
 * `serverFetch` — that one authenticates as the admin dashboard's account, so
 * here it would show one visitor another visitor's notifications.
 */

import { ApiError, userServerFetch } from "@/lib/api/user-client";
import type {
  BackendNotification,
  NotificationPage,
} from "@/types/notification";

/** Mutations report `{ success, error? }`; queries return the data directly. */
export interface NotificationActionResult {
  success: boolean;
  error?: string;
}

function toFailure(err: unknown): NotificationActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: "Network error" };
}

/** One page of my notifications, newest first. Page 1 is server-rendered. */
export async function getNotifications(
  page = 1,
  pageSize = 20,
): Promise<NotificationPage> {
  const { data, meta } = await userServerFetch<BackendNotification[]>(
    `/notifications?page=${page}&pageSize=${pageSize}`,
  );
  return { items: data ?? [], hasMore: meta?.hasMore ?? false };
}

/**
 * Unread count for the navbar bell badge. `null` means the session was
 * rejected: the badge hides and its poll stops, instead of throwing an
 * uncaught action error on every tick until the next full page load.
 */
export async function getUnreadNotificationCount(): Promise<number | null> {
  try {
    const { data } = await userServerFetch<{ total: number }>(
      "/notifications/unread-count",
    );
    return data?.total ?? 0;
  } catch (err) {
    // Only a dead session is "expected" here — a poll can outlive its cookie.
    // Anything else (400s, 5xx, network) still reaches the query's error state.
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function markNotificationRead(
  id: string,
): Promise<NotificationActionResult> {
  try {
    await userServerFetch(`/notifications/${id}/read`, { method: "PATCH" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  try {
    await userServerFetch("/notifications/read-all", { method: "PATCH" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function deleteNotification(
  id: string,
): Promise<NotificationActionResult> {
  try {
    await userServerFetch(`/notifications/${id}`, { method: "DELETE" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

export async function deleteAllNotifications(): Promise<NotificationActionResult> {
  try {
    await userServerFetch("/notifications", { method: "DELETE" });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}
