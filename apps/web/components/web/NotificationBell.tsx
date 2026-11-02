"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconBellFilled } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { Link } from "@/i18n/routing";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { notificationKeys } from "@/lib/notifications/queries";
import { notificationPreviewLimit } from "@/lib/notifications/preview-limit";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NotificationUnreadBadge } from "./NotificationUnreadBadge";
import type { BackendNotification } from "@/types/notification";

/** The navbar switches to its compact (hamburger) layout below this width. */
const WIDE_NAV_QUERY = "(min-width: 1024px)";

const BELL_BUTTON =
  "relative bg-card rounded-full h-11 w-11 border border-muted-foreground/50 text-muted-foreground hover:text-gray-700 transition-colors cursor-pointer";

interface PanelProps {
  limit: number;
  onNavigate: () => void;
  title: ReactNode;
}

/** The shared body: header, newest-N list, "View all" footer. */
function RecentPanel({ limit, onNavigate, title }: PanelProps) {
  const t = useTranslations("Notifications");
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...notificationKeys.recent(), limit],
    queryFn: () => getNotifications(1, limit),
    staleTime: 15 * 1000,
    retry: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.recent() });
  }

  async function markOne(n: BackendNotification) {
    const res = await markNotificationRead(n.id);
    if (!res.success) {
      toast.error(res.error ?? t("couldNotMarkRead"));
      return;
    }
    refresh();
  }

  async function removeOne(n: BackendNotification) {
    const res = await deleteNotification(n.id);
    if (!res.success) {
      toast.error(res.error ?? t("couldNotDelete"));
      return;
    }
    refresh();
  }

  async function markAll() {
    const res = await markAllNotificationsRead();
    if (!res.success) {
      toast.error(res.error ?? t("couldNotMarkAll"));
      return;
    }
    refresh();
  }

  const items = data?.items ?? [];
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-muted px-4 py-3">
        {title}
        {hasUnread ? (
          <button
            type="button"
            onClick={markAll}
            className="type-meta shrink-0 cursor-pointer text-sky-500 hover:underline"
          >
            {t("markAllRead")}
          </button>
        ) : null}
      </div>

      {/* data-vaul-no-drag: scrolling the list must not drag the drawer. */}
      <div
        data-vaul-no-drag
        className="max-h-[min(60vh,26rem)] min-h-0 overflow-y-auto overscroll-contain"
      >
        {isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <p className="type-body-sm text-gray-500">{t("loadFailed")}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="type-nav cursor-pointer text-sky-500 hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center type-body-sm text-gray-500">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y divide-background">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow
                  notification={n}
                  onMarkRead={markOne}
                  onDelete={removeOne}
                  compact
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-muted pb-[env(safe-area-inset-bottom)]">
        <Link
          href="/notifications"
          onClick={onNavigate}
          className="type-nav block py-3 text-center text-sky-500 hover:underline"
        >
          {t("viewAll")}
        </Link>
      </div>
    </div>
  );
}

/**
 * The navbar bell. Opens the newest notifications in place instead of
 * navigating away: a popover on the wide nav, a bottom drawer on the compact
 * nav. Both variants are mounted by their own nav (one is `display: none` at
 * any width), and `open` is forced off for whichever the current width does
 * not use, so a resize across the breakpoint never leaves a stuck overlay.
 */
export function NotificationBell({
  variant,
}: {
  variant: "popover" | "drawer";
}) {
  const t = useTranslations("Notifications");
  const wide = useMediaQuery(WIDE_NAV_QUERY);
  const [requestedOpen, setRequestedOpen] = useState(false);

  const isDrawer = variant === "drawer";
  const active = isDrawer ? !wide : wide;
  const open = requestedOpen && active;
  const limit = notificationPreviewLimit(isDrawer);

  const trigger = (
    <Button
      variant="ghost"
      aria-label={t("title")}
      aria-haspopup="dialog"
      className={BELL_BUTTON}
    >
      <IconBellFilled className="scale-150" />
      <NotificationUnreadBadge />
    </Button>
  );
  const close = () => setRequestedOpen(false);

  if (isDrawer) {
    return (
      <Drawer open={open} onOpenChange={setRequestedOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerDescription className="sr-only">
            {t("recentDescription")}
          </DrawerDescription>
          {open ? (
            <RecentPanel
              limit={limit}
              onNavigate={close}
              title={<DrawerTitle>{t("title")}</DrawerTitle>}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setRequestedOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <RecentPanel
          limit={limit}
          onNavigate={close}
          title={<h2 className="type-card-heading">{t("title")}</h2>}
        />
      </PopoverContent>
    </Popover>
  );
}
