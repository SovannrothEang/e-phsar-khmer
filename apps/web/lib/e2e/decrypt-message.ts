import { withConversationLock } from "./lock";
import type { DecryptOutcome, E2eHeader, E2eStore, RatchetEngine } from "./types";

export interface DecryptableMessage {
  id: string;
  conversationId: string;
  e2eHeader: E2eHeader | null;
  body: string | null;
}

/** True when the header carries X3DH's first-message fields. */
function isNewSessionHeader(header: E2eHeader): boolean {
  return Boolean(
    header.identityKey || header.ephemeralKey || header.oneTimePrekeyId,
  );
}

/**
 * Decrypts one E2E message, exactly once, safely under duplicate delivery
 * (WS push + poll redelivering the same message), out-of-order arrival, and
 * concurrent tabs. See lib/e2e/README.md for the full design rationale.
 *
 * Never throws — a crypto failure on one message must not take down the
 * rest of the thread.
 */
export async function decryptMessage(
  engine: RatchetEngine,
  store: E2eStore,
  message: DecryptableMessage,
): Promise<DecryptOutcome> {
  if (!message.e2eHeader || message.body === null)
    return { status: "failed", reason: "not an E2E message" };
  const header = message.e2eHeader;
  const ciphertext = message.body;

  // Idempotency: a message already decrypted (this session or a prior one)
  // is served from cache — never re-run the ratchet on it. This is what
  // makes duplicate delivery safe: chain keys are single-use, so decrypting
  // the same ciphertext twice would desync the session, not just waste work.
  const cached = await store.getDecrypted(message.id);
  if (cached !== null) return { status: "ok", plaintext: cached };

  return withConversationLock(message.conversationId, async () => {
    // Re-check inside the lock: another tab may have decrypted this exact
    // message while we were waiting to acquire it.
    const cachedInLock = await store.getDecrypted(message.id);
    if (cachedInLock !== null) return { status: "ok", plaintext: cachedInLock };

    // A fresh X3DH handshake always wins over whatever session is cached
    // locally — matches the server-side rule that re-registering keys
    // invalidates prior sessions (spec decision #2 / design §9).
    const priorSession = isNewSessionHeader(header)
      ? null
      : await store.getSession(message.conversationId);

    let result;
    try {
      result = await engine.decrypt(priorSession, header, ciphertext);
    } catch (err) {
      // Nothing persisted on failure — safe to retry from ciphertext later.
      return {
        status: "failed",
        reason: err instanceof Error ? err.message : "decrypt failed",
      };
    }

    // Session state and cached plaintext land in one transaction: a crash
    // between the two would otherwise leave the ratchet advanced with the
    // plaintext lost, making this message permanently undecryptable.
    await store.commit(
      message.conversationId,
      result.session,
      message.id,
      result.plaintext,
    );

    return { status: "ok", plaintext: result.plaintext };
  });
}
