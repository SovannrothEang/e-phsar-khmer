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
import { useRouter } from "@/i18n/routing";
import type { BackendNotification } from "@/types/notification";

interface NotificationRowProps {
  notification: BackendNotification;
  onMarkRead: (notification: BackendNotification) => void;
  onDelete: (notification: BackendNotification) => void;
  /** Called after the row navigates — lets the navbar panel close itself. */
  onNavigate?: () => void;
  /** Smaller icon and clamped text, for the navbar panel. */
  compact?: boolean;
}

/**
 * Owner-facing notices whose listing is no longer public (removed, staff-hidden
 * or over the plan cap) must land on Manage Ads: the public `/post/<id>` detail
 * 404s for those rows. Expiry notices still point at the ad. A staff
 * `listing.edited` notice is left unlinked — staff review it in the admin
 * queue, and that area is outside this router's locale prefix.
 */
const MANAGE_ADS_ROUTES = new Set([
  "listing.removed",
  "listing.inactivated",
  "listing.restricted",
]);

function listingHref(notification: BackendNotification) {
  if (!notification.type.startsWith("listing.")) return null;
  if (MANAGE_ADS_ROUTES.has(notification.type)) return "/me" as const;
  if (notification.type === "listing.edited") return null;
  const listingId = notification.data?.listingId;
  if (typeof listingId !== "string" || listingId.length === 0) return null;
  return { pathname: "/post/[slug]" as const, params: { slug: listingId } };
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
  onNavigate,
  compact = false,
}: NotificationRowProps) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const href = listingHref(notification);
  const clickable = href !== null || !notification.isRead;

  const activate = () => {
    if (!notification.isRead) onMarkRead(notification);
    if (!href) return;
    router.push(href);
    onNavigate?.();
  };

  return (
    <div
      className={`flex items-start transition-colors ${compact ? "p-3" : "p-4"}
        ${notification.isRead ? "bg-background hover:bg-gray-200" : "bg-muted hover:bg-gray-200"}`}
    >
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={
          // A linked row navigates, so announce its destination title; only a
          // mark-read-only row says "mark as read".
          href
            ? notification.title
            : notification.isRead
              ? undefined
              : t("markRowAria", { title: notification.title })
        }
        onClick={() => {
          if (!clickable) return;
          activate();
        }}
        onKeyDown={(event) => {
          if (!clickable) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
        className={`flex min-w-0 flex-1 items-start text-left outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-sky-500 ${
          clickable ? "cursor-pointer" : "cursor-default"
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
