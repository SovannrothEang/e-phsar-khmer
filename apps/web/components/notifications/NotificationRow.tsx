"use client";

import { useLocale, useTranslations } from "next-intl";
import { IconBellFilled } from "@tabler/icons-react";
import { MoreVertical, ShieldAlert } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNotificationDate } from "@/lib/notifications/format-date";
import type { BackendNotification } from "@/types/notification";

interface NotificationRowProps {
  notification: BackendNotification;
  onMarkRead: (notification: BackendNotification) => void;
  onDelete: (notification: BackendNotification) => void;
  /** Smaller icon and clamped text, for the navbar panel. */
  compact?: boolean;
}

/**
 * One notification line, shared by the `/notifications` page and the navbar
 * bell panel. The message area is the click target (clicking an unread row
 * marks it read); the 3-dot menu is a sibling, so its clicks never bubble into
 * that handler.
 */
export function NotificationRow({
  notification,
  onMarkRead,
  onDelete,
  compact = false,
}: NotificationRowProps) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  return (
    <div
      className={`flex items-start transition-colors ${compact ? "p-3" : "p-4"}
        ${notification.isRead ? "bg-background hover:bg-gray-200" : "bg-muted hover:bg-gray-200"}`}
    >
      <div
        role={notification.isRead ? undefined : "button"}
        tabIndex={notification.isRead ? undefined : 0}
        aria-label={
          notification.isRead
            ? undefined
            : t("markRowAria", { title: notification.title })
        }
        onClick={() => {
          if (!notification.isRead) onMarkRead(notification);
        }}
        onKeyDown={(event) => {
          if (notification.isRead) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onMarkRead(notification);
          }
        }}
        className={`flex min-w-0 flex-1 items-start text-left outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-sky-500 ${
          notification.isRead ? "cursor-default" : "cursor-pointer"
        }`}
      >
        <div
          className={`flex-shrink-0 bg-muted rounded-full flex items-center justify-center ${
            compact ? "w-10 h-10" : "w-14 h-14"
          }`}
        >
          {notification.type === "security.new_login" ? (
            <ShieldAlert className="text-amber-600" />
          ) : (
            <IconBellFilled />
          )}
        </div>

        <div className={`min-w-0 flex-1 ${compact ? "ml-3" : "ml-4"}`}>
          <p
            className={`text-foreground type-body break-words ${compact ? "line-clamp-2" : ""}`}
          >
            {notification.title}
          </p>
          {notification.body ? (
            <p
              className={`type-body-sm text-gray-600 mt-1 break-words ${compact ? "line-clamp-2" : ""}`}
            >
              {notification.body}
            </p>
          ) : null}
          <p className="type-meta text-gray-600 mt-1">
            {formatNotificationDate(notification.createdAt, locale)}
          </p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("actionsAria", { title: notification.title })}
          className={`rounded-full transition-all text-gray-400 hover:bg-gray-100 cursor-pointer outline-none ${
            compact ? "p-2.5" : "p-3"
          }`}
        >
          <MoreVertical className="text-xl" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {notification.isRead ? null : (
            <DropdownMenuItem
              className="text-sky-500 cursor-pointer"
              onClick={() => onMarkRead(notification)}
            >
              {t("markRead")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive cursor-pointer"
            onClick={() => onDelete(notification)}
          >
            {tCommon("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
