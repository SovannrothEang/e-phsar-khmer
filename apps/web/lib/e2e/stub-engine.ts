import type { DecryptResult, E2eHeader, EncryptResult, RatchetEngine, RatchetSession } from "./types";

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
export const stubEngine: RatchetEngine = {
  async decrypt(
    session: RatchetSession | null,
    header: E2eHeader,
    ciphertext: string,
  ): Promise<DecryptResult> {
    return {
      plaintext: ciphertext,
      session: { ...(session ?? {}), lastN: header.n, lastDh: header.dh },
    };
  },

  async encrypt(session: RatchetSession | null, plaintext: string): Promise<EncryptResult> {
    const current = session ?? {};
    const n = typeof current.lastN === "number" ? current.lastN + 1 : 0;
    const header: E2eHeader = { v: 1, dh: "stub-dh-key", pn: 0, n };
    return {
      header,
      ciphertext: plaintext,
      session: { ...current, lastN: n, lastDh: header.dh },
    };
  },
};
