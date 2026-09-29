"use client";

import { useHistoryRestoredGeneration } from "@/hooks/use-history-restored";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { decryptMessage, isDecryptable } from "@/lib/e2e/decrypt-message";
import { createIndexedDbStore } from "@/lib/e2e/store";
import type { DecryptOutcome, E2eStore, RatchetEngine } from "@/lib/e2e/types";

/**
 * Decrypts E2E messages as they arrive, via the real Signal engine
 * (lib/e2e/crypto/engine.ts) bootstrapped by useE2eEngine.
 *
 * Each message id is dispatched to decryptMessage() at most once per mount,
 * tracked by a ref rather than the `results` state itself — putting `results`
 * in the effect's dependencies would re-run it on every state update.
 * decrypt-message.ts's own IndexedDB-backed idempotency is what makes repeat
 * delivery (WS push + poll redelivering the same message) safe *across*
 * mounts/reloads; this ref only avoids redundant dispatch *within* one.
 *
 * A null `engine` (still bootstrapping, or bootstrap failed) is a no-op —
 * callers render a neutral placeholder rather than ever showing ciphertext.
 */
export function useDecryptedMessages(
  messages: ChatMessage[],
  engine: RatchetEngine | null,
): Map<string, DecryptOutcome> {
  const [results, setResults] = useState<Map<string, DecryptOutcome>>(
    () => new Map(),
  );
  const storeRef = useRef<E2eStore | null>(null);
  const dispatchedRef = useRef(new Set<string>());
  const restoreGeneration = useHistoryRestoredGeneration(dispatchedRef);

  useEffect(() => {
    if (!engine) return;
    if (!storeRef.current) storeRef.current = createIndexedDbStore();
    const store = storeRef.current;

    const pending = messages.filter(
      (m) => isDecryptable(m) && !dispatchedRef.current.has(m.id),
    );
    if (pending.length === 0) return;
    pending.forEach((m) => dispatchedRef.current.add(m.id));

    // Cleanup (the message list changed, or the engine did) stops the loop,
    // but the ids it never reached were already marked dispatched — hand them
    // back, or the next run skips them and they sit on "Decrypting…" forever.
    let cancelled = false;
    void (async () => {
      for (const [i, message] of pending.entries()) {
        if (cancelled) {
          for (const rest of pending.slice(i))
            dispatchedRef.current.delete(rest.id);
          return;
        }
        const outcome = await decryptMessage(engine, store, {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          body: message.body,
          e2eHeader: message.e2eHeader,
          e2eVersion: message.e2eVersion,
          senderDeviceId: message.senderDeviceId,
          envelopes: message.envelopes,
        });
        // An outcome is keyed by message id, so it stays valid even if the
        // list changed while we waited — always record it.
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
  }, [messages, engine, restoreGeneration]);

  return results;
}
