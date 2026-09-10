"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchUnreadCount } from "@/actions/chat";
import { chatKeys, unwrap } from "@/lib/chat/queries";
import { CHAT_POLL } from "@/hooks/use-chat-polling";
import { cn } from "@/lib/utils";

/**
 * Nav badge for unread messages. Rides on `GET /chats/unread-count` — cheap,
 * but it sits on every page, so it refreshes on the slowest tier (60s) and
 * never while the tab is backgrounded. Renders nothing when there is nothing
 * to show, including for signed-out visitors (the request 401s and we stay
 * quiet rather than flashing an error).
 */
export function ChatUnreadBadge({ className }: { className?: string }) {
  const t = useTranslations("Chat");
  const { data } = useQuery({
    queryKey: chatKeys.unread(),
    queryFn: async () => unwrap(await fetchUnreadCount()),
    refetchInterval: CHAT_POLL.unreadBadgeMs,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 30 * 1000,
  });

  if (!data || data <= 0) return null;

  return (
    <span
      aria-label={t("inbox.unreadCount", { count: data })}
      className={cn(
        "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-[#f04d4e] px-1 text-[10px] font-bold leading-none text-white",
        className,
      )}
    >
      {data > 99 ? "99+" : data}
    </span>
  );
}
