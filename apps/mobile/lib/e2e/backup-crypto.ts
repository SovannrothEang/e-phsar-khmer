import { argon2idAsync } from "@noble/hashes/argon2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import {
  aeadDecrypt,
  aeadEncrypt,
  randomBytes,
  utf8ToBytes,
} from "./crypto/primitives";
import type { BackupKdfParams } from "@/lib/api/backup";

export interface PlaintextItem {
  messageId: string;
  plaintext: string;
}

/**
 * Pure crypto for the chat-history backup, ported from the web:
 *
 *   BK (32 random bytes, per account, never leaves a device in the clear)
 *     ├─ keyCheck   = HMAC(BK, "npic-backup-check")         → server (public)
 *     ├─ segments   = AES-GCM(BK, JSON items)                → server
 *     └─ wrappedKey = AES-GCM(wrapKey, BK)                   → server
 *   master  = argon2id(passcode, salt)
 *   wrapKey = HKDF(master, "npic-backup-wrap")               (never sent)
 *   authKey = HKDF(master, "npic-backup-auth")               → server (bcrypt'd)
 */

/** OWASP's argon2id baseline (m=19 MiB, t=2, p=1) — what the web registers. */
export const DEFAULT_KDF: BackupKdfParams = {
  alg: "argon2id",
  t: 2,
  m: 19456,
  p: 1,
};

export const MIN_PASSCODE_LENGTH = 6;

const WRAP_AAD = utf8ToBytes("npic-backup-key-v1");
const SEGMENT_AAD = utf8ToBytes("npic-backup-segment-v1");

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function newBackupKey(): Uint8Array {
  return randomBytes(32);
}

export function keyCheckOf(bk: Uint8Array): string {
  return bytesToBase64(hmac(sha256, bk, utf8ToBytes("npic-backup-check")));
}

/** Secret proof of holding BK; the server stores only its hash. */
export function keyProofOf(bk: Uint8Array): string {
  return bytesToBase64(hmac(sha256, bk, utf8ToBytes("npic-backup-proof")));
}

export async function derivePasscodeKeys(
  passcode: string,
  saltB64: string,
  params: BackupKdfParams,
): Promise<{ wrapKey: Uint8Array; authKey: string }> {
  // NFKC so the same passcode typed on two keyboards derives the same key.
  const master = await argon2idAsync(
    utf8ToBytes(passcode.normalize("NFKC")),
    base64ToBytes(saltB64),
    { t: params.t, m: params.m, p: params.p, dkLen: 32 },
  );
  return {
    wrapKey: hkdf(
      sha256,
      master,
      undefined,
      utf8ToBytes("npic-backup-wrap"),
      32,
    ),
    authKey: bytesToBase64(
      hkdf(sha256, master, undefined, utf8ToBytes("npic-backup-auth"), 32),
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

export function sealSegment(bk: Uint8Array, items: PlaintextItem[]): string {
  const payload = {
    v: 1,
    items: items.map((item) => [item.messageId, item.plaintext] as const),
  };
  return bytesToBase64(
    aeadEncrypt(bk, utf8ToBytes(JSON.stringify(payload)), SEGMENT_AAD),
  );
}

export function openSegment(
  bk: Uint8Array,
  ciphertext: string,
): PlaintextItem[] {
  const json = decodeUtf8(
    aeadDecrypt(bk, base64ToBytes(ciphertext), SEGMENT_AAD),
  );
  const payload = JSON.parse(json) as { v: number; items: [string, string][] };
  if (payload.v !== 1 || !Array.isArray(payload.items)) return [];
  return payload.items
    .filter(
      (item): item is [string, string] =>
        Array.isArray(item) &&
        typeof item[0] === "string" &&
        typeof item[1] === "string",
    )
    .map(([messageId, plaintext]) => ({ messageId, plaintext }));
}

/** Opens a page, skipping (not stopping at) segments this key cannot open. */
export function openSegments(
  segments: readonly { ciphertext: string }[],
  bk: Uint8Array,
): PlaintextItem[] {
  const items: PlaintextItem[] = [];
  for (const segment of segments) {
    try {
      items.push(...openSegment(bk, segment.ciphertext));
    } catch {
      /* corrupt or under another key — skip */
    }
  }
  return items;
}
