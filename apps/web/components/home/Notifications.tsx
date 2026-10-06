"use client";

import * as React from "react";
import { IconBellFilled } from "@tabler/icons-react";
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
import type { BackendNotification } from "@/types/notification";

/** Matches the backend's own default page size. */
const PAGE_SIZE = 20;

/** The template's date format — "12, Aug 2026". */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  return `${day}, ${month} ${date.getFullYear()}`;
}

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
  const [items, setItems] = React.useState(initial);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [page, setPage] = React.useState(1);
  const [loadingMore, setLoadingMore] = React.useState(false);

  async function markOne(notification: BackendNotification) {
    const res = await markNotificationRead(notification.id);
    if (!res.success) {
      toast.error(res.error ?? "Could not mark as read");
      return;
    }
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, isRead: true, readAt } : item,
      ),
    );
  }

  async function removeOne(notification: BackendNotification) {
    const res = await deleteNotification(notification.id);
    if (!res.success) {
      toast.error(res.error ?? "Could not delete");
      return;
    }
    setItems((current) =>
      current.filter((item) => item.id !== notification.id),
    );
  }

  async function markAll() {
    const res = await markAllNotificationsRead();
    if (!res.success) {
      toast.error(res.error ?? "Could not mark all as read");
      return;
    }
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.isRead ? item : { ...item, isRead: true, readAt },
      ),
    );
  }

  async function removeAll() {
    const res = await deleteAllNotifications();
    if (!res.success) {
      toast.error(res.error ?? "Could not delete notifications");
      return;
    }
    setItems([]);
    setHasMore(false);
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
      toast.error("Could not load more notifications");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted py-6 px-4">
      {/* Removed overflow-hidden here to allow sticky to work relative to the viewport */}
      <div className="max-w-[980px] mx-auto bg-background rounded-sm shadow-sm border border-muted relative">
        {/* Header Section */}
        <div className="flex items-center justify-between p-4 border-b border-muted sticky top-0 z-10 bg-background">
          <h1 className="text-xl font-semibold text-foreground">
            Notifications
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Notification options"
              className="p-2 rounded-full transition-colors text-gray-500 hover:bg-gray-100 cursor-pointer outline-none"
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-sky-500 cursor-pointer"
                onClick={markAll}
              >
                Mark all as read
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={removeAll}
              >
                Delete all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            No notifications yet.
          </p>
        ) : (
          <ul className="divide-y divide-background">
            {items.map((notification) => (
              <li key={notification.id}>
                <div
                  className={`flex items-start p-4 transition-colors
                    ${notification.isRead ? "bg-background hover:bg-gray-200" : "bg-muted hover:bg-gray-200"}`}
                >
                  {/* Bell Icon Circle */}
                  <div className="flex-shrink-0 w-14 h-14 bg-muted rounded-full flex items-center justify-center ">
                    <IconBellFilled />
                  </div>

                  {/* Text Content */}
                  <div className="ml-4 flex-1">
                    <p className="text-foreground text-[17px] leading-tight">
                      {notification.title}
                    </p>
                    {notification.body ? (
                      <p className="text-sm text-gray-600 leading-tight mt-1">
                        {notification.body}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-600 font-medium mt-1">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>

                  {/* Per-notification actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${notification.title}`}
                      className="p-3 rounded-full transition-all text-gray-400 hover:bg-gray-100 cursor-pointer outline-none"
                    >
                      <MoreVertical className="text-xl" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {notification.isRead ? null : (
                        <DropdownMenuItem
                          className="text-sky-500 cursor-pointer"
                          onClick={() => markOne(notification)}
                        >
                          Mark as read
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive cursor-pointer"
                        onClick={() => removeOne(notification)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Footer: the rest of the feed, or its end */}
        {hasMore ? (
          <div className="py-4 flex items-center justify-center border-t border-gray-50">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm font-medium text-sky-500 hover:underline disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : items.length > 0 ? (
          <h1 className="item-center text-center text-gray-400 py-4">
            No more result!
          </h1>
        ) : null}
      </div>
    </div>
  );
}
