import { base64ToBytes, bytesToBase64 } from "./base64";
import { ratchetDecrypt, ratchetEncrypt } from "./double-ratchet";
import type { DrSession } from "./double-ratchet";
import { x3dhInitiate, x3dhRespond } from "./x3dh";
import type { KeyPair } from "./primitives";
import type { E2eHeader, EncryptResult, RatchetEngine, RatchetSession } from "../types";

/**
 * The local, private half of E2E: this device's own long-term key material.
 * Deliberately not sourced or persisted by this module — createSignalEngine
 * only consumes it, so it stays agnostic to where keys are generated, how
 * they're stored, or how/when they get registered via POST /chats/e2e/keys.
 * That bootstrap flow lives in lib/e2e/keys.ts + engine-provider.ts.
 *
 * getOneTimePrekey's caller (the engine) does not — and cannot — mark the
 * returned prekey as consumed; implementations MUST do that themselves.
 * Reusing a one-time prekey across two sessions breaks forward secrecy for
 * whichever session used it second.
 */
export interface LocalKeyMaterial {
  identity: KeyPair;
  getSignedPrekey(id: number): KeyPair | null;
  getOneTimePrekey(id: number): KeyPair | null;
}

function isNewSessionHeader(header: E2eHeader): boolean {
  return Boolean(
    header.identityKey || header.ephemeralKey || header.oneTimePrekeyId !== undefined,
  );
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

/**
 * Real RatchetEngine over @noble/curves + @noble/ciphers, replacing
 * stub-engine.ts. `LocalKeyMaterial` is sourced by lib/e2e/engine-provider.ts
 * (IndexedDB-backed identity store + POST /chats/e2e/keys registration).
 */
export function createSignalEngine(myKeys: LocalKeyMaterial): RatchetEngine {
  return {
    async decrypt(session, header, ciphertext) {
      let drSession: DrSession;

      if (isNewSessionHeader(header)) {
        if (!header.identityKey || !header.ephemeralKey || header.signedPrekeyId === undefined)
          throw new Error("new-session header missing required X3DH fields");

        const signedPrekey = myKeys.getSignedPrekey(header.signedPrekeyId);
        if (!signedPrekey) throw new Error(`unknown signed prekey id ${header.signedPrekeyId}`);

        const oneTimePrekey =
          header.oneTimePrekeyId !== undefined
            ? myKeys.getOneTimePrekey(header.oneTimePrekeyId)
            : null;
        if (header.oneTimePrekeyId !== undefined && !oneTimePrekey)
          throw new Error(`unknown one-time prekey id ${header.oneTimePrekeyId}`);

        drSession = x3dhRespond(
          myKeys.identity,
          signedPrekey,
          oneTimePrekey,
          base64ToBytes(header.identityKey),
          base64ToBytes(header.ephemeralKey),
        );
      } else {
        if (!session) throw new Error("no session, and header carries no X3DH init fields");
        drSession = session as unknown as DrSession;
      }

      const result = ratchetDecrypt(drSession, header, base64ToBytes(ciphertext));
      return {
        plaintext: utf8Decoder.decode(result.plaintext),
        session: result.session as unknown as RatchetSession,
      };
    },

    async encrypt(session, plaintext, bundle): Promise<EncryptResult> {
      let drSession: DrSession;
      let x3dhFields: Pick<
        E2eHeader,
        "identityKey" | "ephemeralKey" | "oneTimePrekeyId" | "signedPrekeyId"
      > = {};

      if (session) {
        drSession = session as unknown as DrSession;
      } else {
        if (!bundle) throw new Error("no session and no bundle to start one from");
        const { session: newSession, ephemeralPublicKey } = x3dhInitiate(
          myKeys.identity,
          bundle,
        );
        drSession = newSession;
        x3dhFields = {
          identityKey: bytesToBase64(myKeys.identity.publicKey),
          ephemeralKey: bytesToBase64(ephemeralPublicKey),
          signedPrekeyId: bundle.signedPrekeyId,
          ...(bundle.oneTimePrekey ? { oneTimePrekeyId: bundle.oneTimePrekey.prekeyId } : {}),
        };
      }

      const result = ratchetEncrypt(drSession, utf8Encoder.encode(plaintext));
      const header: E2eHeader = { v: 1, ...result.header, ...x3dhFields };

      return {
        header,
        ciphertext: bytesToBase64(result.ciphertext),
        session: result.session as unknown as RatchetSession,
      };
    },
  };
}
