"use client";

import { Loader2, MessagesSquare } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { previewOf } from "@/lib/chat/format";
import type { InboxItem } from "@/types/chat";

function RelativeTime({ iso }: { iso: string }) {
  const format = useFormatter();
  // `relativeTime` renders "2 hours ago" in the active locale — no date-fns
  // locale bundles to keep in sync with next-intl's six locales.
  return <>{format.relativeTime(new Date(iso), new Date())}</>;
}

export function ConversationList({
  items,
  activeId,
  onSelect,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  items: InboxItem[];
  activeId: string | null;
  onSelect: (item: InboxItem) => void;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("Chat");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <MessagesSquare className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          {t("inbox.emptyTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("inbox.emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {items.map((item) => {
        const name = item.otherUser?.username ?? t("unknownUser");
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/50",
              activeId === item.id && "bg-muted",
            )}
          >
            <Avatar className="h-10 w-10 shrink-0">
              {item.otherUser?.profilePhotoUrl && (
                <AvatarImage
                  src={item.otherUser.profilePhotoUrl}
                  alt={name}
                />
              )}
              <AvatarFallback className="font-semibold">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  <RelativeTime iso={item.lastMessageAt} />
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "truncate text-xs",
                    item.unreadCount > 0
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {previewOf(item.lastMessage, {
                    image: t("inbox.previewImage"),
                    listing: t("inbox.previewListing"),
                    none: t("inbox.previewEmpty"),
                  })}
                </p>
                {item.unreadCount > 0 && (
                  <span
                    aria-label={t("inbox.unreadCount", {
                      count: item.unreadCount,
                    })}
                    className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#f04d4e] px-1.5 text-[10px] font-bold text-white"
                  >
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {hasMore && (
        <div className="p-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore && <Loader2 className="size-3 animate-spin" />}
            {t("inbox.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
