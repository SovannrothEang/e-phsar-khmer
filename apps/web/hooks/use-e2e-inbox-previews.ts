"use client";

import { useHistoryRestoredGeneration } from "@/hooks/use-history-restored";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, InboxItem } from "@/types/chat";
import { decryptMessage, isDecryptable } from "@/lib/e2e/decrypt-message";
import { createIndexedDbStore } from "@/lib/e2e/store";
import type { E2eStore, RatchetEngine } from "@/lib/e2e/types";

/**
 * Resolves inbox last-message plaintext for E2E rows so the conversation
 * list can show normal text instead of a placeholder label.
 *
 * Order per message: IndexedDB decrypt cache first (own sends, already-opened
 * threads — no ratchet side effect), then a full decryptMessage when the
 * engine is ready. Decrypting only the *latest* message is safe here: the
 * Double Ratchet stores skipped message keys for earlier n in the same chain,
 * so opening the thread later still decrypts history.
 *
 * Without an engine, cache-only results still land (freshly sent messages).
 */
export function useE2eInboxPreviews(
  items: InboxItem[],
  engine: RatchetEngine | null,
): Map<string, string> {
  const [previews, setPreviews] = useState<Map<string, string>>(
    () => new Map(),
  );
  const storeRef = useRef<E2eStore | null>(null);
  const dispatchedRef = useRef(new Set<string>());
  const restoreGeneration = useHistoryRestoredGeneration(dispatchedRef);

  // Stable identity for the effect: only the E2E last-message ids matter.
  const key = items
    .map((item) =>
      item.lastMessage?.isE2e ? `${item.id}:${item.lastMessage.id}` : "",
    )
    .filter(Boolean)
    .join("|");

  useEffect(() => {
    if (!key) return;
    if (!storeRef.current) storeRef.current = createIndexedDbStore();
    const store = storeRef.current;

    const targets: ChatMessage[] = [];
    for (const item of items) {
      const m = item.lastMessage;
      if (m && isDecryptable(m) && !dispatchedRef.current.has(m.id)) {
        dispatchedRef.current.add(m.id);
        targets.push(m);
      }
    }
    if (targets.length === 0) return;

    // No cancellation: every result is keyed by message id, so one that
    // lands after the inbox changed is still correct.
    void (async () => {
      for (const message of targets) {
        let plaintext: string | null = null;
        try {
          plaintext = await store.getDecrypted(message.id);
          if (plaintext === null && engine) {
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
            if (outcome.status === "ok") plaintext = outcome.plaintext;
          }
        } catch {
          // Preview is best-effort — leave unresolved rather than throw.
        }
        // Keyed by message id: still valid after the list changed.
        if (plaintext === null) {
          // Unresolved (engine not ready yet, or cancelled mid-batch): let a
          // later run retry it instead of leaving the preview blank forever.
          dispatchedRef.current.delete(message.id);
          continue;
        }
        setPreviews((prev) => {
          const next = new Map(prev);
          next.set(message.id, plaintext);
          return next;
        });
      }
    })();
    // `items` is intentionally omitted: `key` is the stable fingerprint of
    // the E2E last messages; re-running on every inbox refetch would only
    // re-check the dispatched set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, engine, restoreGeneration]);

  return previews;
}
