import type { DecryptResult, E2eHeader, RatchetEngine, RatchetSession } from "./types";

/**
 * NOT REAL CRYPTOGRAPHY. Exists only to exercise the reliability layer
 * (idempotent cache, cross-tab lock, transactional persist, per-message
 * failure isolation) before a real Double Ratchet / X3DH implementation is
 * wired in. It treats `ciphertext` as already-plaintext and tracks nothing
 * but the last-seen message number in `session`.
 *
 * Replace with a real `RatchetEngine` (libsignal-client WASM bindings or an
 * equivalent pure-JS implementation) before this ever touches a real key —
 * do not ship this to production chat.
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
};
