"use client";

import { trackInsightEvents } from "@/actions/insights";
import { isListingUuid } from "@/lib/listing-id";
import type { InsightEventInput, ListingEventType } from "@/types/insights";

const MAX_BATCH = 30;
const FLUSH_MS = 500;

const pending = new Map<string, InsightEventInput>();
/** One impression per listing per page document — see `trackImpression`. */
const impressed = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending.size === 0) return;

  const batch = [...pending.values()];
  pending.clear();
  void trackInsightEvents(batch);
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(flush, FLUSH_MS);
}

/**
 * A low-volume action (view, a click). Send it immediately: the click is
 * frequently followed by navigation, and a buffered event would be lost.
 */
export function trackEvent(listingId: string, type: ListingEventType): void {
  if (!isListingUuid(listingId)) return;
  void trackInsightEvents([{ listingId, type }]);
}

/**
 * A feed card was seen. Buffer impressions into one request, and count each
 * listing at most once per page document: Radix unmounts inactive tab content,
 * so toggling grid/list would otherwise double count the same ad.
 */
export function trackImpression(listingId: string): void {
  if (!isListingUuid(listingId) || impressed.has(listingId)) return;

  impressed.add(listingId);
  pending.set(`${listingId}:impression`, { listingId, type: "impression" });

  if (pending.size >= MAX_BATCH) flush();
  else schedule();
}
