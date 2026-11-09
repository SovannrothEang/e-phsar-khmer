"use client";

import {
  Bell,
  CheckCheck,
  ChevronRight,
  FileText,
  Flag,
  MoreVertical,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminNotificationHref } from "@/lib/notifications/admin-links";
import type { BackendNotification } from "@/types/notification";

function timeAgo(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function notificationIcon(type: string) {
  if (type === "report.created") {
    return <Flag className="size-4 text-orange-500" />;
  }
  if (type === "report.threshold") {
    return <ShieldAlert className="size-4 text-red-500" />;
  }
  if (type === "listing.edited") {
    return <FileText className="size-4 text-[#00a0e9]" />;
  }
  return <Bell className="size-4 text-muted-foreground" />;
}

/**
 * One staff notification line, shared by the dashboard bell and the
 * `/wanderer/dashboard/notifications` page. The message area is the click
 * target; the 3-dot menu is a sibling so its clicks never open the row.
 */
export function AdminNotificationRow({
  notification,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  notification: BackendNotification;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const href = adminNotificationHref(notification);
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-border p-3 ${
        notification.isRead ? "bg-card" : "bg-muted/60"
      }`}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-background">
        {notificationIcon(notification.type)}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{notification.title}</span>
          <span className="type-meta shrink-0 text-muted-foreground">
            {timeAgo(notification.createdAt)}
          </span>
        </span>
        {notification.body ? (
          <span className="mt-0.5 line-clamp-2 whitespace-normal type-meta text-muted-foreground">
            {notification.body}
          </span>
        ) : null}
        {href ? (
          <span className="mt-1 inline-flex items-center type-meta text-[#00a0e9]">
            Open
            <ChevronRight className="ml-0.5 size-3" />
          </span>
        ) : null}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer"
            aria-label="Notification actions"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!notification.isRead ? (
            <DropdownMenuItem onSelect={onMarkRead}>
              <CheckCheck className="mr-2 size-4" />
              Mark read
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
