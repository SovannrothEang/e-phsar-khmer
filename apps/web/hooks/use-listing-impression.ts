"use client";

import { useEffect, useRef } from "react";
import { trackImpression } from "@/lib/insights/queue";

/**
 * Fires one impression when a listing card is at least half visible.
 * Returns the ref to attach to the card's root element.
 *
 * The effect is keyed by the listing id and resets its guard on every run, so
 * React Strict Mode's setup/cleanup/setup cycle cannot suppress the event, and
 * a component reused across listings (client navigation) still tracks each id.
 */
export function useListingImpression<T extends HTMLElement = HTMLDivElement>(
  listingId: string | number,
) {
  const ref = useRef<T | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    tracked.current = false;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const id = String(listingId);
    const observer = new IntersectionObserver(
      (entries) => {
        if (tracked.current) return;
        if (!entries.some((entry) => entry.isIntersecting)) return;

        tracked.current = true;
        trackImpression(id);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [listingId]);

  return ref;
}
