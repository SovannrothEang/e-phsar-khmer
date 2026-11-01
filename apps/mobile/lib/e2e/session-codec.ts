import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import type { RatchetSession } from "./types";

/**
 * The web persists ratchet sessions in IndexedDB, whose structured clone
 * keeps `Uint8Array` fields intact. AsyncStorage is JSON, so every byte array
 * must be tagged and base64-encoded on the way in and restored on the way
 * out — otherwise the engine would receive `{0:..,1:..}` objects instead of
 * `Uint8Array`s and every DH step would fail.
 */
const BYTES_TAG = "__u8";

export function encodeSession(session: RatchetSession): string {
  return JSON.stringify(encodeValue(session));
}

export function decodeSession(raw: string | null): RatchetSession | null {
  if (!raw) return null;
  try {
    return decodeValue(JSON.parse(raw)) as RatchetSession;
  } catch {
    return null;
  }
}

function encodeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { [BYTES_TAG]: bytesToBase64(value) };
  }
  if (Array.isArray(value)) {
    return value.map(encodeValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        encodeValue(entry),
      ]),
    );
  }
  return value;
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(decodeValue);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record[BYTES_TAG] === "string") {
      return base64ToBytes(record[BYTES_TAG]);
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [key, decodeValue(entry)]),
    );
  }
  return value;
}
