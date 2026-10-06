"use client";

import { useEffect, useState } from "react";
import { getE2eEngine, subscribeE2eEngine } from "@/lib/e2e/engine-provider";
import type { RatchetEngine } from "@/lib/e2e/types";

/** Backoff between bootstrap retries after a failure (ms), capped at the last. */
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

/**
 * Resolve the real Signal engine for `userId`, bootstrapping local keys on
 * first use. Returns null until ready (or while failing) so consumers can
 * gate decrypt/encrypt paths without throwing during render.
 *
 * A failed bootstrap is NOT terminal: the hook retries with backoff, and it
 * also subscribes to the provider so an engine bootstrapped by any other
 * caller (e.g. a send's own getE2eEngine retry) lands here immediately.
 * Without both, one transient failure (a stale server-action id after a
 * deploy, a token-refresh race) left an open thread stuck on "Decrypting…"
 * until it remounted.
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
    let ready = false;
    let failures = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const accept = (engine: RatchetEngine) => {
      if (cancelled) return;
      ready = true;
      clearTimeout(retryTimer);
      setResolved((prev) =>
        prev?.userId === userId && prev.engine === engine
          ? prev
          : { userId, engine },
      );
    };

    const unsubscribe = subscribeE2eEngine((forUser, engine) => {
      if (forUser === userId) accept(engine);
    });

    const attempt = () => {
      getE2eEngine(userId)
        .then(accept)
        .catch((err: unknown) => {
          if (cancelled || ready) return;
          console.warn("[e2e] engine bootstrap failed; retrying", err);
          // Fail closed: clear any prior-user engine so consumers refuse E2E
          // operations rather than falling back to plaintext (spec #6).
          setResolved((prev) => (prev?.userId === userId ? null : prev));
          const delay =
            RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
          failures += 1;
          retryTimer = setTimeout(attempt, delay);
        });
    };
    attempt();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      unsubscribe();
    };
  }, [userId]);

  if (!userId || resolved?.userId !== userId) return null;
  return resolved.engine;
}
