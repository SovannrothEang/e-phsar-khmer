import { argon2idAsync } from "@noble/hashes/argon2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import { aeadDecrypt, aeadEncrypt } from "./crypto/primitives";
import type { PlaintextItem } from "./store";

/**
 * Pure crypto for the chat-history backup. No I/O — see backup.ts for the
 * flows that use it.
 *
 *   BK (32 random bytes, per account, never leaves a device in the clear)
 *     ├─ keyCheck   = HMAC(BK, "npic-backup-check")         → server (public)
 *     ├─ segments   = AES-GCM(BK, JSON items)                → server
 *     └─ wrappedKey = AES-GCM(wrapKey, BK)                   → server
 *   master  = argon2id(passcode, salt)
 *   wrapKey = HKDF(master, "npic-backup-wrap")               (never sent)
 *   authKey = HKDF(master, "npic-backup-auth")               → server (bcrypt'd)
 *
 * The server can release wrappedKey only to someone proving authKey, which
 * is what lets it rate-limit guesses. A compromised server could still
 * brute-force the passcode offline against wrappedKey, so passcode strength
 * matters: argon2id makes each guess cost ~19 MiB and real time.
 */

export interface BackupKdfParams {
  alg: "argon2id";
  t: number;
  m: number;
  p: number;
}

/** OWASP's argon2id baseline (m=19 MiB, t=2, p=1). */
export const DEFAULT_KDF: BackupKdfParams = {
  alg: "argon2id",
  t: 2,
  m: 19456,
  p: 1,
};

export const MIN_PASSCODE_LENGTH = 6;

const enc = new TextEncoder();
const dec = new TextDecoder();
const WRAP_AAD = enc.encode("npic-backup-key-v1");
const SEGMENT_AAD = enc.encode("npic-backup-segment-v1");

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function newBackupKey(): Uint8Array {
  return randomBytes(32);
}

export function keyCheckOf(bk: Uint8Array): string {
  return bytesToBase64(hmac(sha256, bk, enc.encode("npic-backup-check")));
}

/**
 * Secret proof of holding BK. Unlike keyCheck (public — the server returns
 * it to any session of the account), the server stores only sha256 of this
 * and never returns it, so a stolen session can't forge a passcode change.
 */
export function keyProofOf(bk: Uint8Array): string {
  return bytesToBase64(hmac(sha256, bk, enc.encode("npic-backup-proof")));
}

export async function derivePasscodeKeys(
  passcode: string,
  saltB64: string,
  params: BackupKdfParams,
): Promise<{ wrapKey: Uint8Array; authKey: string }> {
  // NFKC so the same passcode typed on two keyboards derives the same key.
  const master = await argon2idAsync(
    enc.encode(passcode.normalize("NFKC")),
    base64ToBytes(saltB64),
    { t: params.t, m: params.m, p: params.p, dkLen: 32 },
  );
  return {
    wrapKey: hkdf(
      sha256,
      master,
      undefined,
      enc.encode("npic-backup-wrap"),
      32,
    ),
    authKey: bytesToBase64(
      hkdf(sha256, master, undefined, enc.encode("npic-backup-auth"), 32),
    ),
  };
}

export function wrapBackupKey(wrapKey: Uint8Array, bk: Uint8Array): string {
  return bytesToBase64(aeadEncrypt(wrapKey, bk, WRAP_AAD));
}

export function unwrapBackupKey(
  wrapKey: Uint8Array,
  wrapped: string,
): Uint8Array {
  return aeadDecrypt(wrapKey, base64ToBytes(wrapped), WRAP_AAD);
}

/** UTF-8 bytes one item adds to a segment's JSON payload (incl. separator). */
export function segmentItemBytes(item: PlaintextItem): number {
  return enc.encode(JSON.stringify([item.messageId, item.plaintext])).length + 1;
}

export function sealSegment(bk: Uint8Array, items: PlaintextItem[]): string {
  const payload = {
    v: 1,
    items: items.map((i) => [i.messageId, i.plaintext] as const),
  };
  return bytesToBase64(
    aeadEncrypt(bk, enc.encode(JSON.stringify(payload)), SEGMENT_AAD),
  );
}

export function openSegment(
  bk: Uint8Array,
  ciphertext: string,
): PlaintextItem[] {
  const json = dec.decode(
    aeadDecrypt(bk, base64ToBytes(ciphertext), SEGMENT_AAD),
  );
  const payload = JSON.parse(json) as { v: number; items: [string, string][] };
  if (payload.v !== 1 || !Array.isArray(payload.items)) return [];
  return payload.items
    .filter(
      (i): i is [string, string] =>
        Array.isArray(i) &&
        typeof i[0] === "string" &&
        typeof i[1] === "string",
    )
    .map(([messageId, plaintext]) => ({ messageId, plaintext }));
}
