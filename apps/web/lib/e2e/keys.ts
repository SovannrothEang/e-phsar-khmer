import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import {
  generateEd25519KeyPair,
  generateX25519KeyPair,
  sign,
} from "./crypto/primitives";
import type { KeyPair } from "./crypto/primitives";
import type { LocalKeyMaterial } from "./crypto/engine";

const DB_NAME = "npic-e2e-identity";
const DB_VERSION = 1;
const STORE = "identity"; // keyPath: userId

/** Signal's own initial pool size (spec decision #7). */
export const INITIAL_OTP_COUNT = 100;
/** Replenish when the server-side pool drops below this (spec decision #7). */
export const REPLENISH_THRESHOLD = 10;

interface StoredKeyPair {
  publicKey: string; // base64
  secretKey: string; // base64
}

interface StoredOneTimePrekey {
  id: number;
  key: StoredKeyPair;
}

/**
 * Long-term key material for ONE account on THIS browser profile. Private
 * halves never leave IndexedDB — only the public fields are uploaded via
 * POST /chats/e2e/keys (spec design §9).
 */
export interface StoredIdentity {
  userId: string;
  registrationId: number;
  identity: StoredKeyPair; // X25519, DH
  signing: StoredKeyPair; // Ed25519, signs the signed prekey (decision #9)
  signedPrekey: { id: number; key: StoredKeyPair };
  /** base64 Ed25519 signature over signedPrekey.key.publicKey. */
  signedPrekeySignature: string;
  oneTimePrekeys: StoredOneTimePrekey[];
  nextPrekeyId: number;
  /** False until POST /chats/e2e/keys has succeeded at least once (v1). */
  registered: boolean;
  /**
   * v2 device id from POST /chats/e2e/devices. Absent on identities created
   * before multi-device — those claim their migration-backfilled device (same
   * identity key) on the next bootstrap, so no keys are regenerated.
   */
  deviceId?: string;
  /**
   * base64 account backup key (BK) — present once this device created the
   * backup, restored it with the passcode, or was approved by another
   * device. Encrypts the history segments this device uploads.
   */
  backupKey?: string;
  /** Backup segments up to here are already pulled into `restored`. */
  backupCursor?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "userId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function encodeKeyPair(kp: KeyPair): StoredKeyPair {
  return {
    publicKey: bytesToBase64(kp.publicKey),
    secretKey: bytesToBase64(kp.secretKey),
  };
}

function decodeKeyPair(sp: StoredKeyPair): KeyPair {
  return {
    publicKey: base64ToBytes(sp.publicKey),
    secretKey: base64ToBytes(sp.secretKey),
  };
}

function randomRegistrationId(): number {
  // Signal's registration id is a 14-bit uint — a per-installation tag,
  // not a secret.
  const buf = new Uint16Array(1);
  crypto.getRandomValues(buf);
  return buf[0] & 0x3fff;
}

export function generateOneTimePrekeys(
  startId: number,
  count: number,
): StoredOneTimePrekey[] {
  const out: StoredOneTimePrekey[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: startId + i, key: encodeKeyPair(generateX25519KeyPair()) });
  }
  return out;
}

/** Generate a full identity from scratch (first bootstrap for this account). */
export function generateIdentity(userId: string): StoredIdentity {
  const identity = encodeKeyPair(generateX25519KeyPair());
  const signing = encodeKeyPair(generateEd25519KeyPair());
  const signedPrekeyKp = generateX25519KeyPair();
  const signature = sign(
    signedPrekeyKp.publicKey,
    base64ToBytes(signing.secretKey),
  );
  return {
    userId,
    registrationId: randomRegistrationId(),
    identity,
    signing,
    signedPrekey: { id: 1, key: encodeKeyPair(signedPrekeyKp) },
    signedPrekeySignature: bytesToBase64(signature),
    oneTimePrekeys: generateOneTimePrekeys(1, INITIAL_OTP_COUNT),
    nextPrekeyId: 1 + INITIAL_OTP_COUNT,
    registered: false,
  };
}

export async function loadIdentity(
  userId: string,
): Promise<StoredIdentity | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const row = await reqToPromise<StoredIdentity | undefined>(
    tx.objectStore(STORE).get(userId),
  );
  return row ?? null;
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(identity);
  await txDone(tx);
}

/**
 * Project persisted material into the seam `createSignalEngine` consumes.
 * OTKs are never deleted locally on use — the server's SKIP LOCKED claim is
 * what prevents two sessions from being handed the same prekey; keeping the
 * private half lets a crashed first-decrypt retry.
 */
export function toLocalKeyMaterial(identity: StoredIdentity): LocalKeyMaterial {
  const identityKp = decodeKeyPair(identity.identity);
  const signedPrekeyId = identity.signedPrekey.id;
  const signedPrekeyKp = decodeKeyPair(identity.signedPrekey.key);
  const otp = new Map(
    identity.oneTimePrekeys.map((p) => [p.id, decodeKeyPair(p.key)]),
  );
  return {
    identity: identityKp,
    getSignedPrekey(id) {
      return id === signedPrekeyId ? signedPrekeyKp : null;
    },
    getOneTimePrekey(id) {
      return otp.get(id) ?? null;
    },
  };
}

/** Public halves only — the payload for POST /chats/e2e/keys. */
export function publicRegistrationPayload(
  identity: StoredIdentity,
  oneTimePrekeys: StoredOneTimePrekey[],
) {
  return {
    identityKey: identity.identity.publicKey,
    identitySigningKey: identity.signing.publicKey,
    registrationId: identity.registrationId,
    signedPrekeyId: identity.signedPrekey.id,
    signedPrekeyPublic: identity.signedPrekey.key.publicKey,
    signedPrekeySignature: identity.signedPrekeySignature,
    oneTimePrekeys: oneTimePrekeys.map((p) => ({
      prekeyId: p.id,
      publicKey: p.key.publicKey,
    })),
  };
}
