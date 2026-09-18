"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { fetchConversationWith } from "@/actions/chat";

/**
 * "Message seller" entry point for a listing page.
 *
 * Resolves the thread with `GET /chats/with/:userId` first — read-only, it
 * never creates a conversation — then hands off to `/chats`, where the
 * composer sends the first message with `listingId` attached so the seller
 * sees the ad the buyer is asking about. The thread row only comes into
 * existence on that first send.
 *
 * Renders nothing when `sellerId` is missing or is the viewer's own id: the
 * backend rejects self-messages with a 400 and there is nothing useful to show.
 */
export function ContactSellerButton({
  sellerId,
  listingId,
  viewerId,
  className,
  size = "default",
  variant = "default",
}: {
  sellerId: string | null | undefined;
  listingId?: string;
  /** Pass the signed-in user's id when the host page has it, to hide the
   *  button on your own ad without an extra request. */
  viewerId?: string | null;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const t = useTranslations("Chat");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolving, setResolving] = useState(false);

  if (!sellerId || (viewerId && viewerId === sellerId)) return null;

  async function open() {
    if (!sellerId) return;
    setResolving(true);
    const res = await fetchConversationWith(sellerId);
    setResolving(false);

    if (!res.ok) {
      if (res.status === 401) {
        toast.error(t("auth.requiredTitle"));
        startTransition(() => router.push("/login"));
        return;
      }
      toast.error(res.message || t("errors.generic"));
      return;
    }

    if (!res.data.canMessage) {
      toast.error(t("composer.blocked"));
      return;
    }

    const query = listingId
      ? { to: sellerId, listing: listingId }
      : { to: sellerId };
    startTransition(() => router.push({ pathname: "/chats", query }));
  }

  const busy = resolving || pending;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={busy}
      onClick={() => void open()}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <MessageCircle className="size-4" />
      )}
      {t("messageSeller")}
    </Button>
  );
}
