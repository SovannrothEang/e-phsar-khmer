// Pure-JS base64: React Native has no guaranteed btoa/atob, and the web's
// implementation depends on them. Same wire format (standard alphabet,
// padded), so keys/ciphertext interoperate byte for byte.

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    const chunk =
      (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    output +=
      ALPHABET[(chunk >> 18) & 63] +
      ALPHABET[(chunk >> 12) & 63] +
      ALPHABET[(chunk >> 6) & 63] +
      ALPHABET[chunk & 63];
  }

  const remaining = bytes.length - index;
  if (remaining === 1) {
    const chunk = bytes[index] << 16;
    output +=
      ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63] + "==";
  } else if (remaining === 2) {
    const chunk = (bytes[index] << 16) | (bytes[index + 1] << 8);
    output +=
      ALPHABET[(chunk >> 18) & 63] +
      ALPHABET[(chunk >> 12) & 63] +
      ALPHABET[(chunk >> 6) & 63] +
      "=";
  }

  return output;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const length = (clean.length / 4) * 3 - padding;
  const bytes = new Uint8Array(length);
  let byteIndex = 0;

  for (let index = 0; index < clean.length; index += 4) {
    const c0 = ALPHABET.indexOf(clean[index]);
    const c1 = ALPHABET.indexOf(clean[index + 1]);
    const c2 =
      clean[index + 2] === "=" ? 0 : ALPHABET.indexOf(clean[index + 2]);
    const c3 =
      clean[index + 3] === "=" ? 0 : ALPHABET.indexOf(clean[index + 3]);
    const chunk = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;

    if (byteIndex < length) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < length) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < length) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes;
}
