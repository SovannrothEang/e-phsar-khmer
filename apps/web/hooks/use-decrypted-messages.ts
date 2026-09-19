"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { decryptMessage } from "@/lib/e2e/decrypt-message";
import { createIndexedDbStore } from "@/lib/e2e/store";
import type { DecryptOutcome, E2eStore, RatchetEngine } from "@/lib/e2e/types";

/**
 * Decrypts E2E messages as they arrive. Not yet wired into message-thread.tsx
 * or conversation-list.tsx — this is the reliability layer in isolation,
 * built against a stub RatchetEngine (see lib/e2e/stub-engine.ts) until a
 * real Double Ratchet implementation is chosen.
 *
 * Each message id is dispatched to decryptMessage() at most once per mount,
 * tracked by a ref rather than the `results` state itself — putting `results`
 * in the effect's dependencies would re-run it on every state update.
 * decrypt-message.ts's own IndexedDB-backed idempotency is what makes repeat
 * delivery (WS push + poll redelivering the same message) safe *across*
 * mounts/reloads; this ref only avoids redundant dispatch *within* one.
 */
export function useDecryptedMessages(
  messages: ChatMessage[],
  engine: RatchetEngine,
): Map<string, DecryptOutcome> {
  const [results, setResults] = useState<Map<string, DecryptOutcome>>(
    () => new Map(),
  );
  const storeRef = useRef<E2eStore | null>(null);
  const dispatchedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!storeRef.current) storeRef.current = createIndexedDbStore();
    const store = storeRef.current;

    const pending = messages.filter(
      (m) =>
        m.isE2e &&
        m.e2eHeader &&
        m.body !== null &&
        !dispatchedRef.current.has(m.id),
    );
    if (pending.length === 0) return;
    pending.forEach((m) => dispatchedRef.current.add(m.id));

    let cancelled = false;
    void (async () => {
      for (const message of pending) {
        const outcome = await decryptMessage(engine, store, {
          id: message.id,
          conversationId: message.conversationId,
          e2eHeader: message.e2eHeader,
          body: message.body,
        });
        if (cancelled) return;
        setResults((prev) => {
          const next = new Map(prev);
          next.set(message.id, outcome);
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, engine]);

  return results;
}
