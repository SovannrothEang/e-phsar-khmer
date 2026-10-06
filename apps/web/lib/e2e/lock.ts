/**
 * Serializes ratchet advancement for one conversation across browser tabs.
 * Two tabs open to the same thread must never both consume the next chain
 * key for an incoming message — that would advance the same session twice
 * from two different in-memory copies, and only one write would survive.
 *
 * Falls back to running `fn` directly when the Web Locks API is unavailable
 * (older browsers, non-browser test environments) — single-tab usage is
 * unaffected either way; multi-tab races are simply unguarded there.
 */
export function withConversationLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) return fn();
  // lib.dom's LockGrantedCallback<T> types the callback as returning T, not
  // Promise<T> — it doesn't model the (spec-correct) async-callback case the
  // real API supports. The runtime awaits a returned promise regardless.
  return navigator.locks.request(
    `e2e-session-${conversationId}`,
    fn,
  ) as unknown as Promise<T>;
}

/**
 * The single lock guarding ALL v2 (per-device) session state. v2 sessions
 * with the sender's own other devices are shared across every conversation,
 * so a per-conversation lock can't protect them.
 */
export const V2_LOCK = "v2-devices";
