/**
 * Wire/crypto types for the mobile E2E client. Mirrors
 * `apps/web/lib/e2e/types.ts` and `apps/web/types/chat.ts` for the subset the
 * phone uses (v2 text messages; no attachments or backups).
 */

export interface E2eHeader {
  v: 1;
  dh: string;
  pn: number;
  n: number;
  identityKey?: string;
  ephemeralKey?: string;
  oneTimePrekeyId?: number;
  signedPrekeyId?: number;
}

/** v2: the message content key, ratchet-encrypted for one device. */
export interface E2eEnvelope {
  recipientDeviceId: string;
  header: E2eHeader;
  wrappedKey: string;
}

/** v2 send payload — mirrors the backend's `E2eV2PayloadDto`. */
export interface E2eV2Payload {
  v: 2;
  senderDeviceId: string;
  envelopes: E2eEnvelope[];
}

/**
 * Opaque Double Ratchet state, persisted between sends/decrypts. The
 * orchestration layer never reads its fields — see `store.ts`.
 */
export type RatchetSession = Record<string, unknown>;

export interface EncryptResult {
  header: E2eHeader;
  ciphertext: string;
  session: RatchetSession;
  /** base64 identity key of the peer this session is with. */
  remoteIdentityKey: string;
}

/** The public halves of one device's key material (`GET …/devices/:id/bundle`). */
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

export interface RatchetEngine {
  readonly userId: string | null;
  readonly deviceId: string | null;
  decrypt(
    session: RatchetSession | null,
    header: E2eHeader,
    ciphertext: string,
  ): Promise<DecryptResult>;
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
