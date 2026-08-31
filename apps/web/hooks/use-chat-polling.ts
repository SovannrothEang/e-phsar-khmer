"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chat has no WebSocket layer by design — clients poll `?after=<latestCursor>`
 * for deltas. Server cost therefore scales linearly with poll frequency, so a
 * flat 3s timer across every open tab is the single fastest way to melt the
 * API. These tiers are the whole backoff policy; change them here and nowhere
 * else.
 */
export const CHAT_POLL = {
  /** Thread visible and recently interacted with. */
  activeMs: 3_000,
  /** Visible but quiet for a while — the conversation has gone cold. */
  warmMs: 10_000,
  /** Visible but abandoned; the tab is just parked on the page. */
  idleMs: 30_000,
  /** Quiet for this long → drop to `warmMs`. */
  warmAfterMs: 20_000,
  /** Quiet for this long → drop to `idleMs`. */
  idleAfterMs: 90_000,
  /** How often the tier itself is re-evaluated (local only, no network). */
  tickMs: 5_000,
  /** Inbox refresh while the thread list is on screen. */
  inboxMs: 20_000,
  /** Nav unread badge — cheap endpoint, but it is on every page. */
  unreadBadgeMs: 60_000,
} as const;

export interface AdaptivePolling {
  /** Feed straight into TanStack Query's `refetchInterval`. */
  refetchInterval: number | false;
  /** False while `document.visibilityState === "hidden"`. */
  isVisible: boolean;
  /** Call on send / typing / scroll / thread switch to snap back to `activeMs`. */
  markActivity: () => void;
}

/**
 * Visibility- and idle-aware poll interval.
 *
 * Polling stops outright when the tab is hidden (`refetchInterval: false`) —
 * a backgrounded tab has nothing to render and TanStack Query refetches on
 * mount/reconnect anyway, so there is no state to catch up on beyond the next
 * foreground poll. When visible, the interval degrades 3s → 10s → 30s as the
 * thread goes quiet, and any user activity snaps it back to 3s.
 */
export function useAdaptivePolling(enabled: boolean): AdaptivePolling {
  const [isVisible, setIsVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const [intervalMs, setIntervalMs] = useState<number>(CHAT_POLL.activeMs);
  // Seeded on mount, not at render time: `Date.now()` is impure, and calling
  // it during render is unsafe under concurrent rendering (a render may be
  // discarded and replayed). 0 means "not yet seeded" and is treated as fresh
  // activity by the idle tick below.
  const lastActivityAt = useRef<number>(0);

  const markActivity = useCallback(() => {
    lastActivityAt.current = Date.now();
    setIntervalMs((prev) =>
      prev === CHAT_POLL.activeMs ? prev : CHAT_POLL.activeMs,
    );
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      // Coming back to the tab counts as activity: the user wants fresh data
      // now, not in 30 seconds.
      if (visible) {
        lastActivityAt.current = Date.now();
        setIntervalMs(CHAT_POLL.activeMs);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (lastActivityAt.current === 0) lastActivityAt.current = Date.now();
    const id = window.setInterval(() => {
      const quietFor = Date.now() - lastActivityAt.current;
      const next =
        quietFor >= CHAT_POLL.idleAfterMs
          ? CHAT_POLL.idleMs
          : quietFor >= CHAT_POLL.warmAfterMs
            ? CHAT_POLL.warmMs
            : CHAT_POLL.activeMs;
      setIntervalMs((prev) => (prev === next ? prev : next));
    }, CHAT_POLL.tickMs);
    return () => window.clearInterval(id);
  }, [enabled]);

  return {
    refetchInterval: enabled && isVisible ? intervalMs : false,
    isVisible,
    markActivity,
  };
}
