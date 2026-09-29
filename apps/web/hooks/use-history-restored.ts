"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { E2E_HISTORY_RESTORED } from "@/lib/e2e/backup";

/**
 * Bumps a counter whenever chat history is restored from the backup, after
 * clearing the caller's "already dispatched" set — so decrypt hooks retry
 * every message (rows that came back "unavailable" can now resolve from the
 * restored copy; rows that already decrypted just hit the cache).
 */
export function useHistoryRestoredGeneration(
  dispatchedRef: RefObject<Set<string>>,
): number {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const onRestored = () => {
      dispatchedRef.current.clear();
      setGeneration((g) => g + 1);
    };
    window.addEventListener(E2E_HISTORY_RESTORED, onRestored);
    return () => window.removeEventListener(E2E_HISTORY_RESTORED, onRestored);
  }, [dispatchedRef]);
  return generation;
}
