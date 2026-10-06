import type { E2eEnvelope, E2eHeader } from "@/types/chat";

export type { E2eEnvelope, E2eHeader };

/**
 * Opaque Double Ratchet state. Whatever a `RatchetEngine` needs to carry
 * between calls (root key, chain keys, skipped-message keys, ...) lives in
 * here — the orchestration layer (decrypt-message.ts, send-encrypt.ts) never
 * reads its fields, only persists and replays it.
 *
 * v1 keys one session per conversation; v2 keys one per peer DEVICE
 * (`${peerUserId}:${peerDeviceId}`) — see peerKey() in store.ts.
 */
export type RatchetSession = Record<string, unknown>;

export interface EncryptResult {
  header: E2eHeader;
  ciphertext: string;
  session: RatchetSession;
  /**
   * base64 identity key of the peer this session is with. v1 sends it to the
   * server so a session against a since-replaced identity is rejected (409
   * E2E_SESSION_STALE) instead of stored undecryptable.
   */
  remoteIdentityKey: string;
}

/** The public halves of a recipient's key material (v1 per-user or v2 per-device bundle). */
export interface RemoteKeyBundle {
  identityKey: string;
  identitySigningKey: string;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekey: { prekeyId: number; publicKey: string } | null;
}

export interface DecryptResult {
  plaintext: string;
  session: RatchetSession;
}

export interface DecryptBytesResult {
  plaintext: Uint8Array;
  session: RatchetSession;
}

export interface EncryptBytesResult extends Omit<EncryptResult, "ciphertext"> {
  ciphertext: string; // base64
}

/**
 * The crypto seam. `session` is null when no prior session exists locally —
 * either genuinely new, or the caller intentionally discarded it because
 * the header carries a fresh X3DH handshake (see decrypt-message.ts).
 *
 * An implementation is responsible for its OWN skipped-message-key bookkeeping
 * (bounded — Signal caps at ~1000 per chain) inside the returned `session`;
 * the orchestration layer only persists whatever session blob comes back.
 */
export interface RatchetEngine {
  /** The account these keys belong to (null for the test stub). */
  readonly userId: string | null;
  /** This browser's v2 device id; null until registered (v2 unavailable). */
  readonly deviceId: string | null;
  decrypt(
    session: RatchetSession | null,
    header: E2eHeader,
    ciphertext: string,
  ): Promise<DecryptResult>;
  /** `bundle` is required exactly when `session` is null — starting a session needs somewhere to start it from. */
  encrypt(
    session: RatchetSession | null,
    plaintext: string,
    bundle?: RemoteKeyBundle,
  ): Promise<EncryptResult>;
  /** v2: same ratchet, raw bytes (the wrapped content key) instead of UTF-8 text. */
  decryptBytes(
    session: RatchetSession | null,
    header: E2eHeader,
    ciphertext: string,
  ): Promise<DecryptBytesResult>;
  encryptBytes(
    session: RatchetSession | null,
    plaintext: Uint8Array,
    bundle?: RemoteKeyBundle,
  ): Promise<EncryptBytesResult>;
}

/** Minimal persistence contract the orchestration layer needs — swappable for tests. */
export interface E2eStore {
  /** v1: session keyed by conversation. */
  getSession(conversationId: string): Promise<RatchetSession | null>;
  /** Cached plaintext for a message, from either v1 or v2 storage. */
  getDecrypted(messageId: string): Promise<string | null>;
  /** v1: persists the new session and the cached plaintext in one transaction. */
  commit(
    conversationId: string,
    session: RatchetSession,
    messageId: string,
    plaintext: string,
  ): Promise<void>;
  /**
   * Plaintext restored from the history backup — a FALLBACK, consulted only
   * after this device's own decrypt comes back unavailable/failed.
   */
  getRestored(messageId: string): Promise<string | null>;
  /** v2: persist advanced sessions with no message attached (key-transfer envelopes). */
  commitSessions(
    sessions: { peerKey: string; session: RatchetSession }[],
  ): Promise<void>;
  /** v2: session keyed by peer device (`${userId}:${deviceId}`). */
  getDeviceSession(peerKey: string): Promise<RatchetSession | null>;
  /** v2: persists every advanced device session + the cached plaintext in one transaction. */
  commitDevice(
    sessions: { peerKey: string; session: RatchetSession }[],
    messageId: string,
    plaintext: string,
  ): Promise<void>;
}

export type DecryptOutcome =
  | { status: "ok"; plaintext: string }
  /**
   * Not a crypto error: this device has no key for the message — it was
   * sent before this device was set up, or from another of my devices
   * before multi-device. Rendered as a neutral note, not an error.
   */
  | { status: "unavailable" }
  | { status: "failed"; reason: string };
