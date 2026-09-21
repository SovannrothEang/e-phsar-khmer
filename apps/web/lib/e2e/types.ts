import type { E2eHeader } from "@/types/chat";

export type { E2eHeader };

/**
 * Opaque per-conversation Double Ratchet state. Whatever a `RatchetEngine`
 * needs to carry between calls (root key, chain keys, skipped-message keys,
 * ...) lives in here — the orchestration layer in decrypt-message.ts never
 * reads its fields, only persists and replays it.
 */
export type RatchetSession = Record<string, unknown>;

export interface EncryptResult {
  header: E2eHeader;
  ciphertext: string;
  session: RatchetSession;
}

/** The public halves of a recipient's key material, as returned by GET /chats/e2e/keys/:userId/bundle. */
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
}

/** Minimal persistence contract decrypt-message.ts needs — swappable for tests. */
export interface E2eStore {
  getSession(conversationId: string): Promise<RatchetSession | null>;
  getDecrypted(messageId: string): Promise<string | null>;
  /** Persists the new session and the cached plaintext in one transaction. */
  commit(
    conversationId: string,
    session: RatchetSession,
    messageId: string,
    plaintext: string,
  ): Promise<void>;
}

export type DecryptOutcome =
  | { status: "ok"; plaintext: string }
  | { status: "failed"; reason: string };
