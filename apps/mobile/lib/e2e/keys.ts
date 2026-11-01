import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import {
  generateEd25519KeyPair,
  generateX25519KeyPair,
  sign,
} from "./crypto/primitives";
import type { KeyPair } from "./crypto/primitives";
import type { LocalKeyMaterial } from "./crypto/engine";
import type { StoredIdentity, StoredKeyPair, StoredPrekey } from "./store";
import type { RegistrationPayload } from "@/lib/api/e2e";

/** Same steady-state batch the web registers. */
export const INITIAL_OTP_COUNT = 100;
/** Ask for a new batch when the server reports fewer than this left. */
export const REPLENISH_THRESHOLD = 10;

function encodeKeyPair(keyPair: KeyPair): StoredKeyPair {
  return {
    publicKey: bytesToBase64(keyPair.publicKey),
    secretKey: bytesToBase64(keyPair.secretKey),
  };
}

export function decodeKeyPair(keyPair: StoredKeyPair): KeyPair {
  return {
    publicKey: base64ToBytes(keyPair.publicKey),
    secretKey: base64ToBytes(keyPair.secretKey),
  };
}

/** Signal's registration id is a 14-bit uint — a per-installation tag, not a secret. */
function randomRegistrationId(): number {
  const buffer = new Uint8Array(2);
  crypto.getRandomValues(buffer);
  return ((buffer[0] << 8) | buffer[1]) & 0x3fff;
}

export function generatePrekeys(
  startId: number,
  count: number,
): StoredPrekey[] {
  const out: StoredPrekey[] = [];
  for (let index = 0; index < count; index++) {
    out.push({
      id: startId + index,
      key: encodeKeyPair(generateX25519KeyPair()),
    });
  }
  return out;
}

/** A brand-new identity plus its first one-time prekey batch. */
export function generateIdentity(userId: string): {
  identity: StoredIdentity;
  prekeys: StoredPrekey[];
} {
  const identity = encodeKeyPair(generateX25519KeyPair());
  const signing = encodeKeyPair(generateEd25519KeyPair());
  const signedPrekeyKeyPair = generateX25519KeyPair();
  const signature = sign(
    signedPrekeyKeyPair.publicKey,
    base64ToBytes(signing.secretKey),
  );
  const prekeys = generatePrekeys(1, INITIAL_OTP_COUNT);

  return {
    identity: {
      userId,
      registrationId: randomRegistrationId(),
      identity,
      signing,
      signedPrekey: { id: 1, key: encodeKeyPair(signedPrekeyKeyPair) },
      signedPrekeySignature: bytesToBase64(signature),
      nextPrekeyId: 1 + INITIAL_OTP_COUNT,
    },
    prekeys,
  };
}

/**
 * Project the stored material into the engine's seam. One-time prekey private
 * halves are never deleted locally on use — the server's SKIP LOCKED claim is
 * what prevents double use, and keeping the half lets a crashed first decrypt
 * retry.
 */
export function localKeyMaterial(
  identity: StoredIdentity,
  oneTimePrekeys: Map<number, StoredPrekey>,
): LocalKeyMaterial {
  const identityKeyPair = decodeKeyPair(identity.identity);
  const signedPrekeyId = identity.signedPrekey.id;
  const signedPrekeyKeyPair = decodeKeyPair(identity.signedPrekey.key);

  return {
    identity: identityKeyPair,
    getSignedPrekey(id) {
      return id === signedPrekeyId ? signedPrekeyKeyPair : null;
    },
    getOneTimePrekey(id) {
      const prekey = oneTimePrekeys.get(id);
      return prekey ? decodeKeyPair(prekey.key) : null;
    },
  };
}

/** Public halves only — the body for POST /chats/e2e/devices. */
export function publicRegistrationPayload(
  identity: StoredIdentity,
  oneTimePrekeys: StoredPrekey[],
  label?: string,
): RegistrationPayload {
  return {
    identityKey: identity.identity.publicKey,
    identitySigningKey: identity.signing.publicKey,
    registrationId: identity.registrationId,
    signedPrekeyId: identity.signedPrekey.id,
    signedPrekeyPublic: identity.signedPrekey.key.publicKey,
    signedPrekeySignature: identity.signedPrekeySignature,
    oneTimePrekeys: oneTimePrekeys.map((prekey) => ({
      prekeyId: prekey.id,
      publicKey: prekey.key.publicKey,
    })),
    ...(label ? { label } : {}),
  };
}
