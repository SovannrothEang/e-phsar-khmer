"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/chat/format";
import type { ListingContext } from "@/types/chat";

/**
 * The listing card attached to a chat message — the core marketplace
 * interaction ("I'm asking about *this* ad").
 *
 * `listing` is null when the ad has since been deleted: the FK is
 * ON DELETE SET NULL, so the message survives its listing and we render a
 * tombstone rather than dropping the card.
 */
export function ListingContextCard({
  listing,
  className,
}: {
  listing: ListingContext | null;
  className?: string;
}) {
  const t = useTranslations("Chat");
  const locale = useLocale();

  if (!listing) {
    return (
      <div
        className={cn(
          "w-56 max-w-full rounded-xl border border-dashed border-border bg-card/60 px-3 py-4 text-xs text-muted-foreground",
          className,
        )}
      >
        {t("listing.unavailable")}
      </div>
    );
  }

  const price = formatPrice(listing.price, listing.currency, locale);
  const inactive = listing.status !== "active";

  return (
    <div
      className={cn(
        "w-56 max-w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="relative flex h-28 items-center justify-center bg-muted">
        {listing.thumbnailUrl ? (
          <Image
            src={listing.thumbnailUrl}
            alt={listing.title}
            fill
            sizes="224px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <ImageOff className="size-7 text-muted-foreground" />
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-xs font-medium text-foreground">
          {listing.title}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-[#f04d4e]">
            {price ?? t("listing.noPrice")}
          </p>
          {inactive && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t(`listing.status.${listing.status}`)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
