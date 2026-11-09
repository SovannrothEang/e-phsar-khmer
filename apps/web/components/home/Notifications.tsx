"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import {
  deleteAllNotifications,
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { notificationKeys } from "@/lib/notifications/queries";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import type { BackendNotification } from "@/types/notification";

/** Matches the backend's own default page size. */
const PAGE_SIZE = 20;

interface NotificationsProps {
  /** Page one, fetched by the page's server component. */
  initial: BackendNotification[];
  initialHasMore: boolean;
}

/**
 * The notifications feed. Both 3-dot menus are the real controls: the header's
 * acts on every notification, the row's on that one — "Mark as read" is
 * offered only while the row is unread, "Delete" always.
 *
 * Page one arrives as a prop (server-rendered); everything after it is local
 * state mutated by the actions. Nothing here has to survive a navigation: the
 * next visit re-reads the server's copy.
 */
export default function Notifications({
  initial,
  initialHasMore,
}: NotificationsProps) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const [items, setItems] = React.useState(initial);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [page, setPage] = React.useState(1);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const queryClient = useQueryClient();

  /** Keep the navbar bell badge and its recent-list panel in step with this page's mutations. */
  function refreshUnreadCount() {
    void queryClient.invalidateQueries({
      queryKey: notificationKeys.unread(),
    });
    void queryClient.invalidateQueries({
      queryKey: notificationKeys.recent(),
    });
  }

  async function markOne(notification: BackendNotification) {
    const res = await markNotificationRead(notification.id);
    if (!res.success) {
      toast.error(res.error ?? t("couldNotMarkRead"));
      return;
    }
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, isRead: true, readAt } : item,
      ),
    );
    refreshUnreadCount();
  }

  async function removeOne(notification: BackendNotification) {
    const res = await deleteNotification(notification.id);
    if (!res.success) {
      toast.error(res.error ?? t("couldNotDelete"));
      return;
    }
    setItems((current) =>
      current.filter((item) => item.id !== notification.id),
    );
    refreshUnreadCount();
  }

  async function markAll() {
    const res = await markAllNotificationsRead();
    if (!res.success) {
      toast.error(res.error ?? t("couldNotMarkAll"));
      return;
    }
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.isRead ? item : { ...item, isRead: true, readAt },
      ),
    );
    refreshUnreadCount();
  }

  async function removeAll() {
    const res = await deleteAllNotifications();
    if (!res.success) {
      toast.error(res.error ?? t("couldNotDeleteAll"));
      return;
    }
    setItems([]);
    setHasMore(false);
    refreshUnreadCount();
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      // Queries return the data and throw on failure — unlike the mutations
      // above, which report `{ success, error? }` — so this one catches.
      const next = await getNotifications(page + 1, PAGE_SIZE);
      setItems((current) => [...current, ...next.items]);
      setHasMore(next.hasMore);
      setPage((current) => current + 1);
    } catch {
      toast.error(t("couldNotLoadMore"));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted pt-6 pb-10 px-4">
      {/* Removed overflow-hidden here to allow sticky to work relative to the viewport */}
      <div className="max-w-[980px] mx-auto bg-background rounded-sm shadow-sm border border-muted relative">
        {/* Header Section */}
        <div className="flex items-center justify-between p-4 border-b border-muted sticky top-0 z-10 bg-background">
          <h1 className="type-section-title text-foreground">{t("title")}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("options")}
              className="p-2 rounded-full transition-colors text-muted-foreground hover:bg-muted cursor-pointer outline-none"
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-sky-500 cursor-pointer"
                onClick={markAll}
              >
                {t("markAllRead")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={removeAll}
              >
                {t("deleteAll")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {items.length === 0 ? (
          <p className="py-10 text-center type-body-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y divide-background">
            {items.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  notification={notification}
                  onMarkRead={markOne}
                  onDelete={removeOne}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Footer: the rest of the feed, or its end */}
        {hasMore ? (
          <div className="py-4 flex items-center justify-center border-t border-border">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="type-nav text-sky-500 hover:underline disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? tCommon("loading") : tCommon("loadMore")}
            </button>
          </div>
        ) : items.length > 0 ? (
          <h1 className="item-center text-center type-meta text-muted-foreground py-4">
            {t("noMore")}
          </h1>
        ) : null}
      </div>
    </div>
  );
}
