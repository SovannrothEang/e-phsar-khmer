import { apiFetch } from "@/lib/api/client";

export interface BackendNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: BackendNotification[];
  hasMore: boolean;
  total: number;
}

export async function fetchNotifications(
  page = 1,
  pageSize = 20,
): Promise<NotificationPage> {
  const { data, meta } = await apiFetch<BackendNotification[]>(
    `/notifications?page=${page}&pageSize=${pageSize}`,
  );
  return {
    items: data ?? [],
    hasMore: Boolean(meta?.hasMore),
    total: Number(meta?.total ?? 0),
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiFetch<{ total: number }>(
    "/notifications/unread-count",
  );
  return data?.total ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch<{ marked: number }>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: "PATCH" },
  );
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<{ marked: number }>("/notifications/read-all", {
    method: "PATCH",
  });
}

export async function deleteNotification(id: string): Promise<void> {
  await apiFetch<{ deleted: number }>(
    `/notifications/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function deleteAllNotifications(): Promise<void> {
  await apiFetch<{ deleted: number }>("/notifications", { method: "DELETE" });
}
