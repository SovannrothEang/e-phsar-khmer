"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Flag,
  Loader2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { AdminNotificationRow } from "./admin-notification-row";
import { getListingReports, getUserReports } from "@/actions/admin-reports";
import {
  deleteAdminNotification,
  getAdminNotifications,
  getAdminUnreadNotificationCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "@/actions/admin-notifications";
import {
  ADMIN_NOTIFICATIONS_PAGE,
  ADMIN_REPORT_QUEUES,
  adminNotificationHref,
} from "@/lib/notifications/admin-links";
import { toast } from "@/components/ui/sonner";
import type { BackendNotification } from "@/types/notification";

/** Matches the storefront badge and the report-queue cadence. */
const POLL_MS = 60_000;
const RECENT_LIMIT = 8;

/** The report queues are unpaginated, so this is the exact pending count. */
function pendingLabel(
  rows: readonly { status: string }[] | undefined,
): string | null {
  if (!rows) return null;
  const pending = rows.filter((row) => row.status === "pending").length;
  return pending === 0 ? null : String(pending);
}

function ShortcutRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/**
 * The bell is the staff notification feed: the admin's own `notifications`
 * rows (new reports, edited listings, thresholds) plus a shortcut to the two
 * moderation queues. The badge is the true unread count, not a queue count.
 */
export default function Notifications() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ["admin", "notifications", "unread"],
    queryFn: getAdminUnreadNotificationCount,
    // `null` is the action's "admin session rejected" answer; keep polling only
    // while the session is good, or a signed-out tab re-runs it forever.
    refetchInterval: (query) => (query.state.data === null ? false : POLL_MS),
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 30_000,
  });
  const unreadCount = unread ?? 0;

  const {
    data: feed,
    isLoading: feedLoading,
    isError: feedError,
  } = useQuery({
    queryKey: ["admin", "notifications", "recent"],
    queryFn: () => getAdminNotifications(1, RECENT_LIMIT),
    enabled: open,
    // An open drawer must pick up a notification that arrives while it is
    // open; the badge poll alone would leave the rows stale.
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 30_000,
  });

  // Same keys as the report queues, so the shortcut counts and the queue pages
  // share one fetch.
  const { data: userReports } = useQuery({
    queryKey: ["admin", "reports", "users"],
    queryFn: getUserReports,
    retry: false,
    refetchInterval: POLL_MS,
  });
  const { data: listingReports } = useQuery({
    queryKey: ["admin", "reports", "listings"],
    queryFn: getListingReports,
    retry: false,
    refetchInterval: POLL_MS,
  });

  const userPending = pendingLabel(userReports);
  const listingPending = pendingLabel(listingReports);
  const items = feed?.items ?? [];

  const refreshNotifications = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });

  const openHref = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const markRead = async (notification: BackendNotification) => {
    const res = await markAdminNotificationRead(notification.id);
    if (!res.success) {
      toast.error(res.error ?? "Could not mark the notification read");
      return;
    }
    void refreshNotifications();
  };

  const openNotification = (notification: BackendNotification) => {
    if (!notification.isRead) void markRead(notification);
    const href = adminNotificationHref(notification);
    if (href) openHref(href);
  };

  const remove = async (notification: BackendNotification) => {
    const res = await deleteAdminNotification(notification.id);
    if (!res.success) {
      toast.error(res.error ?? "Could not delete the notification");
      return;
    }
    void refreshNotifications();
    toast.success("Notification deleted");
  };

  const markAll = async () => {
    const res = await markAllAdminNotificationsRead();
    if (!res.success) {
      toast.error(res.error ?? "Could not mark all as read");
      return;
    }
    void refreshNotifications();
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative cursor-pointer rounded-full hover:bg-muted/60"
        >
          <Bell className="size-5 text-muted-foreground" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 type-photo-badge text-white antialiased">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DrawerTrigger>

      <DrawerContent className="ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-card">
        <DrawerHeader className="border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle>Notifications</DrawerTitle>
              <DrawerDescription>
                {feedError
                  ? "Could not load notifications."
                  : feedLoading
                    ? "Loading…"
                    : unreadCount > 0
                      ? `${unreadCount} unread`
                      : "You're all caught up."}
              </DrawerDescription>
            </div>
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void markAll()}
                className="shrink-0 cursor-pointer type-meta"
              >
                <CheckCheck className="mr-1.5 size-4" />
                Mark all read
              </Button>
            ) : null}
          </div>
        </DrawerHeader>

        <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {userPending ? (
            <ShortcutRow
              icon={<UserRound className="size-4 text-[#00a0e9]" />}
              label={`${userPending} user report${userPending === "1" ? "" : "s"} waiting`}
              onClick={() => openHref(ADMIN_REPORT_QUEUES.users)}
            />
          ) : null}
          {listingPending ? (
            <ShortcutRow
              icon={<Flag className="size-4 text-orange-500" />}
              label={`${listingPending} listing report${listingPending === "1" ? "" : "s"} waiting`}
              onClick={() => openHref(ADMIN_REPORT_QUEUES.listings)}
            />
          ) : null}

          <p className="px-1 pt-2 type-meta font-medium text-muted-foreground">
            Latest
          </p>

          {feedLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : feedError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Bell className="size-8" />
              <p className="type-body-sm">Could not load notifications.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Bell className="size-8" />
              <p className="type-body-sm">No notifications yet.</p>
            </div>
          ) : (
            items.map((notification) => (
              <AdminNotificationRow
                key={notification.id}
                notification={notification}
                onOpen={() => openNotification(notification)}
                onMarkRead={() => void markRead(notification)}
                onDelete={() => void remove(notification)}
              />
            ))
          )}
        </div>

        <div className="border-t border-border px-6 py-3">
          <Button
            variant="ghost"
            className="w-full cursor-pointer"
            onClick={() => openHref(ADMIN_NOTIFICATIONS_PAGE)}
          >
            View all notifications
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
