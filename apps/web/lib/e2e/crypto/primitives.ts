import { x25519, ed25519 } from "@noble/curves/ed25519.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export { concatBytes, randomBytes };

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function generateX25519KeyPair(): KeyPair {
  return x25519.keygen();
}

export function generateEd25519KeyPair(): KeyPair {
  return ed25519.keygen();
}

/** X25519 Diffie-Hellman. */
export function dh(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(secretKey, publicKey);
}

export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, secretKey);
}

export function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  return ed25519.verify(signature, message, publicKey);
}

/**
 * X3DH's KDF (signal.org/docs/specifications/x3dh, §2.2): HKDF-SHA256 over a
 * fixed 32-byte 0xFF prefix (domain-separates this from any other HKDF use
 * of the same input) concatenated with the DH outputs, zero salt.
 */
export function kdfX3dh(dhConcat: Uint8Array, info: string): Uint8Array {
  const prefix = new Uint8Array(32).fill(0xff);
  const salt = new Uint8Array(32);
  return hkdf(sha256, concatBytes(prefix, dhConcat), salt, utf8ToBytes(info), 32);
}

/** Double Ratchet's KDF_RK (signal.org/docs/specifications/doubleratchet, §5.2). */
export function kdfRootKey(
  rootKey: Uint8Array,
  dhOut: Uint8Array,
): [newRootKey: Uint8Array, newChainKey: Uint8Array] {
  const out = hkdf(sha256, dhOut, rootKey, utf8ToBytes("npic-e2e-ratchet"), 64);
  return [out.slice(0, 32), out.slice(32, 64)];
}

/**
 * Double Ratchet's KDF_CK (same spec, §5.2) — HMAC rather than HKDF: a
 * single-round derivation is sufficient here per spec.
 */
export function kdfChainKey(
  chainKey: Uint8Array,
): [newChainKey: Uint8Array, messageKey: Uint8Array] {
  const messageKey = hmac(sha256, chainKey, new Uint8Array([0x01]));
  const newChainKey = hmac(sha256, chainKey, new Uint8Array([0x02]));
  return [newChainKey, messageKey];
}

const NONCE_LENGTH = 12;

/** AES-256-GCM; the nonce is prepended to the returned ciphertext so decrypt is self-contained. */
export function aeadEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  const nonce = randomBytes(NONCE_LENGTH);
  return concatBytes(nonce, gcm(key, nonce, aad).encrypt(plaintext));
}

export function aeadDecrypt(key: Uint8Array, data: Uint8Array, aad: Uint8Array): Uint8Array {
  const nonce = data.slice(0, NONCE_LENGTH);
  const ciphertext = data.slice(NONCE_LENGTH);
  return gcm(key, nonce, aad).decrypt(ciphertext);
}

/** Big-endian uint32 — used to bind a header's pn/n fields into the AEAD associated data. */
export function u32be(n: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, n, false);
  return bytes;
}
