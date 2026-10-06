import { openBody } from "./content";
import { V2_LOCK, withConversationLock } from "./lock";
import { peerKey } from "./store";
import type {
  DecryptOutcome,
  E2eEnvelope,
  E2eHeader,
  E2eStore,
  RatchetEngine,
} from "./types";

export interface DecryptableMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  /** v1 header; null on v2 rows. */
  e2eHeader: E2eHeader | null;
  e2eVersion?: number | null;
  senderDeviceId?: string | null;
  envelopes?: E2eEnvelope[];
}

/** True when the header carries X3DH's first-message fields. */
export function isNewSessionHeader(header: E2eHeader): boolean {
  return Boolean(
    header.identityKey ||
    header.ephemeralKey ||
    header.oneTimePrekeyId !== undefined,
  );
}

/** True for any E2E row this module can attempt (v1 header or v2 envelopes). */
export function isDecryptable(m: {
  isE2e: boolean;
  body: string | null;
  e2eHeader: E2eHeader | null;
  e2eVersion?: number | null;
}): boolean {
  return m.isE2e && m.body !== null && (m.e2eVersion === 2 || !!m.e2eHeader);
}

/**
 * v1 errors that mean "these keys were never on this device" (a session or
 * prekey from another browser) rather than a corrupt message.
 */
const V1_MISSING_KEY_ERRORS = [
  "no session",
  "unknown signed prekey",
  "unknown one-time prekey",
];

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
  if (message.body === null)
    return { status: "failed", reason: "not an E2E message" };

  // Idempotency: a message already decrypted (this session or a prior one,
  // v1 or v2) is served from cache — never re-run the ratchet on it. Chain
  // keys are single-use, so decrypting the same ciphertext twice would
  // desync the session, not just waste work. Own sends land here too: their
  // plaintext is cached at send time.
  const cached = await store.getDecrypted(message.id);
  if (cached !== null) return { status: "ok", plaintext: cached };

  const outcome =
    message.e2eVersion === 2
      ? await decryptV2(engine, store, message)
      : message.e2eHeader
        ? await decryptV1(
            engine,
            store,
            message,
            message.e2eHeader,
            message.body,
          )
        : ({ status: "failed", reason: "not an E2E message" } as const);
  if (outcome.status === "ok") return outcome;

  // This device couldn't read it itself — fall back to a copy restored from
  // the history backup (passcode or another device's approval). Checked
  // only now, never before the real decrypt: see RESTORED_STORE in store.ts.
  const restored = await store.getRestored(message.id);
  return restored !== null ? { status: "ok", plaintext: restored } : outcome;
}

async function decryptV1(
  engine: RatchetEngine,
  store: E2eStore,
  message: DecryptableMessage,
  header: E2eHeader,
  ciphertext: string,
): Promise<DecryptOutcome> {
  // v1 never encrypted to the sender itself: my own message without a cached
  // copy was sent from another browser (or before this one's cache).
  if (engine.userId && message.senderId === engine.userId)
    return { status: "unavailable" };

  return withConversationLock(message.conversationId, async () => {
    // Re-check inside the lock: another tab may have decrypted this exact
    // message while we were waiting to acquire it.
    const cachedInLock = await store.getDecrypted(message.id);
    if (cachedInLock !== null)
      return { status: "ok" as const, plaintext: cachedInLock };

    // A fresh X3DH handshake always wins over whatever session is cached
    // locally — re-registering keys invalidates prior sessions.
    const priorSession = isNewSessionHeader(header)
      ? null
      : await store.getSession(message.conversationId);

    let result;
    try {
      result = await engine.decrypt(priorSession, header, ciphertext);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "decrypt failed";
      if (V1_MISSING_KEY_ERRORS.some((e) => reason.startsWith(e)))
        return { status: "unavailable" as const };
      // Nothing persisted on failure — safe to retry from ciphertext later.
      return { status: "failed" as const, reason };
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
    return { status: "ok" as const, plaintext: result.plaintext };
  });
}

async function decryptV2(
  engine: RatchetEngine,
  store: E2eStore,
  message: DecryptableMessage,
): Promise<DecryptOutcome> {
  const myDeviceId = engine.deviceId;
  if (!myDeviceId) return { status: "failed", reason: "device not registered" };

  // No envelope for this device = the message predates this device joining
  // the account's active set. Expected, not an error.
  const envelope = message.envelopes?.find(
    (e) => e.recipientDeviceId === myDeviceId,
  );
  if (!envelope) return { status: "unavailable" };
  if (!message.senderDeviceId || message.body === null)
    return { status: "failed", reason: "malformed v2 message" };
  const senderDeviceId = message.senderDeviceId;
  const body = message.body;
  const key = peerKey(message.senderId, senderDeviceId);

  return withConversationLock(V2_LOCK, async () => {
    const cachedInLock = await store.getDecrypted(message.id);
    if (cachedInLock !== null)
      return { status: "ok" as const, plaintext: cachedInLock };

    const priorSession = isNewSessionHeader(envelope.header)
      ? null
      : await store.getDeviceSession(key);

    let plaintext: string;
    let session;
    try {
      const unwrapped = await engine.decryptBytes(
        priorSession,
        envelope.header,
        envelope.wrappedKey,
      );
      plaintext = openBody(body, unwrapped.plaintext, senderDeviceId);
      session = unwrapped.session;
    } catch (err) {
      return {
        status: "failed" as const,
        reason: err instanceof Error ? err.message : "decrypt failed",
      };
    }

    await store.commitDevice(
      [{ peerKey: key, session }],
      message.id,
      plaintext,
    );
    return { status: "ok" as const, plaintext };
  });
}
