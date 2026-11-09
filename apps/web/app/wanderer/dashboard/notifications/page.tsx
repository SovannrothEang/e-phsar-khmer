"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Trash2 } from "lucide-react";
import { AdminPage } from "@/components/dashboard/admin-page";
import { AdminNotificationRow } from "@/components/dashboard/admin-notification-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import {
  deleteAdminNotification,
  deleteAllAdminNotifications,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "@/actions/admin-notifications";
import { adminNotificationHref } from "@/lib/notifications/admin-links";
import type { BackendNotification } from "@/types/notification";

const PAGE_SIZE = 20;

/** The admin's own notification history; the bell shows the newest few. */
export default function AdminNotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "notifications", "page", page],
    queryFn: () => getAdminNotifications(page, PAGE_SIZE),
    placeholderData: (previous) => previous,
    retry: false,
  });

  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });

  const markRead = async (notification: BackendNotification) => {
    const res = await markAdminNotificationRead(notification.id);
    if (!res.success) {
      toast.error(res.error ?? "Could not mark the notification read");
      return;
    }
    void refresh();
  };

  const openNotification = (notification: BackendNotification) => {
    if (!notification.isRead) void markRead(notification);
    const href = adminNotificationHref(notification);
    if (href) router.push(href);
  };

  const removeOne = async (notification: BackendNotification) => {
    const res = await deleteAdminNotification(notification.id);
    if (!res.success) {
      toast.error(res.error ?? "Could not delete the notification");
      return;
    }
    // Deleting the last row on a later page leaves an empty page; step back.
    if (items.length === 1 && page > 1) setPage((current) => current - 1);
    void refresh();
    toast.success("Notification deleted");
  };

  const markAll = async () => {
    const res = await markAllAdminNotificationsRead();
    if (!res.success) {
      toast.error(res.error ?? "Could not mark all as read");
      return;
    }
    void refresh();
    toast.success("All notifications marked read");
  };

  const removeAll = async () => {
    const res = await deleteAllAdminNotifications();
    if (!res.success) {
      toast.error(res.error ?? "Could not delete the notifications");
      return;
    }
    setConfirmDeleteAll(false);
    setPage(1);
    void refresh();
    toast.success("All notifications deleted");
  };

  return (
    <>
      <AdminPage
        title="Notifications"
        description="Reports, edited listings and threshold alerts for your staff account."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => void markAll()}
            >
              Mark all read
            </Button>
            <Button
              variant="destructive"
              className="h-9 rounded-sm cursor-pointer bg-red-500 text-white hover:bg-red-600 hover:text-white"
              onClick={() => setConfirmDeleteAll(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete all
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Bell className="size-8" />
            <p className="type-body-sm">Could not load notifications.</p>
            <Button
              variant="outline"
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bell className="size-8" />
            <p className="type-body-sm">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((notification) => (
              <AdminNotificationRow
                key={notification.id}
                notification={notification}
                onOpen={() => openNotification(notification)}
                onMarkRead={() => void markRead(notification)}
                onDelete={() => void removeOne(notification)}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="type-meta text-muted-foreground">Page {page}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={!hasMore}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </AdminPage>

      <Dialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all notifications?</DialogTitle>
            <DialogDescription>
              This removes every notification from your staff feed. It cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => setConfirmDeleteAll(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9 rounded-sm cursor-pointer bg-red-500 text-white hover:bg-red-600 hover:text-white"
              onClick={() => void removeAll()}
            >
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
