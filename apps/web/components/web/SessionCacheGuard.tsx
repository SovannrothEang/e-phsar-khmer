"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resetE2eEngine } from "@/lib/e2e/engine-provider";

/**
 * Identity seen by the previous render, kept at module scope (not a ref)
 * because NavBar remounts when navigating between route groups — a ref would
 * forget the old account exactly when it matters. `undefined` = not yet seen
 * (fresh page load, where the cache is empty anyway).
 */
let lastIdentity: string | null | undefined;

/**
 * The QueryClient lives in `[locale]/layout.tsx`, which survives the soft
 * navigation a server-action logout/login performs — so without this, the
 * previous account's inbox, threads and chat viewer (`["user", "chat", …]`
 * keys, not scoped by user) keep rendering after sign-out or when a different
 * account signs in. Any identity change drops the whole cache and the E2E
 * engine. Covers every path the session can change by (sign-out button,
 * login, expired refresh), not just the explicit logout click.
 */
export function SessionCacheGuard({ identity }: { identity: string | null }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (lastIdentity !== undefined && lastIdentity !== identity) {
      queryClient.clear();
      resetE2eEngine();
    }
    lastIdentity = identity;
  }, [identity, queryClient]);

  return null;
}

/** Explicit sign-out: clear immediately so nothing flashes during the redirect. */
export function markSignedOut(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.clear();
  resetE2eEngine();
  lastIdentity = null;
}
