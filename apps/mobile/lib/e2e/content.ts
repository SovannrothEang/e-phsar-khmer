import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import { aeadDecrypt, aeadEncrypt } from "./crypto/primitives";
import { utf8ToBytes } from "./crypto/primitives";

const CONTENT_KEY_LENGTH = 32;

/** Expo's winter runtime installs TextDecoder; no TextEncoder is assumed. */
function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * v2 message body: encrypted ONCE under a fresh random content key, which
 * each device envelope then wraps via its own Double Ratchet session. The
 * sender's device id is the AEAD associated data, so a body can't be passed
 * off as coming from another device.
 */
export function sealBody(
  plaintext: string,
  senderDeviceId: string,
): { body: string; contentKey: Uint8Array } {
  const contentKey = new Uint8Array(CONTENT_KEY_LENGTH);
  crypto.getRandomValues(contentKey);
  const sealed = aeadEncrypt(
    contentKey,
    utf8ToBytes(plaintext),
    utf8ToBytes(senderDeviceId),
  );
  return { body: bytesToBase64(sealed), contentKey };
}

export function openBody(
  body: string,
  contentKey: Uint8Array,
  senderDeviceId: string,
): string {
  const plaintext = aeadDecrypt(
    contentKey,
    base64ToBytes(body),
    utf8ToBytes(senderDeviceId),
  );
  return decodeUtf8(plaintext);
}
