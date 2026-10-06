import type {
  DecryptResult,
  E2eHeader,
  EncryptResult,
  RatchetEngine,
  RatchetSession,
} from "./types";

/**
 * NOT REAL CRYPTOGRAPHY. A real engine now exists (crypto/engine.ts,
 * @noble/curves + @noble/ciphers) — this stays only for exercising the
 * reliability layer (idempotent cache, cross-tab lock, transactional
 * persist, per-message failure isolation) without needing real key
 * material. It treats `ciphertext`/`plaintext` as interchangeable and
 * tracks nothing but a message counter in `session`.
 *
 * Never wire this into production chat.
 */
async function stubDecrypt(
  session: RatchetSession | null,
  header: E2eHeader,
  ciphertext: string,
): Promise<DecryptResult> {
  return {
    plaintext: ciphertext,
    session: { ...(session ?? {}), lastN: header.n, lastDh: header.dh },
  };
}

async function stubEncrypt(
  session: RatchetSession | null,
  plaintext: string,
): Promise<EncryptResult> {
  const current = session ?? {};
  const n = typeof current.lastN === "number" ? current.lastN + 1 : 0;
  const header: E2eHeader = { v: 1, dh: "stub-dh-key", pn: 0, n };
  return {
    header,
    ciphertext: plaintext,
    session: { ...current, lastN: n, lastDh: header.dh },
    remoteIdentityKey: "stub-identity",
  };
}

const latin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes);
const fromLatin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

export const stubEngine: RatchetEngine = {
  userId: null,
  deviceId: null,
  decrypt: stubDecrypt,
  encrypt: stubEncrypt,
  async decryptBytes(session, header, ciphertext) {
    const r = await stubDecrypt(session, header, ciphertext);
    return { plaintext: fromLatin1(r.plaintext), session: r.session };
  },
  async encryptBytes(session, plaintext) {
    return stubEncrypt(session, latin1(plaintext));
  },
};
