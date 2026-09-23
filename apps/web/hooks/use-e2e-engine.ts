"use client";

import { useEffect, useState } from "react";
import { getE2eEngine } from "@/lib/e2e/engine-provider";
import type { RatchetEngine } from "@/lib/e2e/types";

/**
 * Resolve the real Signal engine for `userId`, bootstrapping local keys on
 * first use. Returns null until ready (or on failure) so consumers can gate
 * decrypt/encrypt paths without throwing during render.
 *
 * State is tagged with the userId it was resolved for so a userId change
 * yields null on the next render without a synchronous setState in the
 * effect — the next bootstrap result for the new user replaces it.
 *
 * The engine is intentionally NOT provided via React context: encrypt (send)
 * and decrypt (render) both need it, they live in different hooks, and the
 * module-level cache in engine-provider already dedupes the work.
 */
export function useE2eEngine(userId: string | null): RatchetEngine | null {
  const [resolved, setResolved] = useState<{
    userId: string;
    engine: RatchetEngine;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getE2eEngine(userId)
      .then((engine) => {
        if (!cancelled) setResolved({ userId, engine });
      })
      .catch(() => {
        // Fail closed: clear any prior-user engine so consumers refuse E2E
        // operations rather than falling back to plaintext (spec #6).
        if (!cancelled)
          setResolved((prev) => (prev?.userId === userId ? null : prev));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId || resolved?.userId !== userId) return null;
  return resolved.engine;
}
