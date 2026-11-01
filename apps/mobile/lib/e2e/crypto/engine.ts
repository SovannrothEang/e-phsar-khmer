import { base64ToBytes, bytesToBase64 } from "./base64";
import { ratchetDecrypt, ratchetEncrypt } from "./double-ratchet";
import type { DrSession } from "./double-ratchet";
import { x3dhInitiate, x3dhRespond } from "./x3dh";
import { utf8ToBytes } from "./primitives";
import type { KeyPair } from "./primitives";
import type {
  DecryptBytesResult,
  E2eHeader,
  EncryptBytesResult,
  RatchetEngine,
  RatchetSession,
  RemoteKeyBundle,
} from "../types";

/**
 * The local, private half of E2E: this device's own long-term key material.
 * Sourced by `lib/e2e/device.ts` (SecureStore-backed identity), so this module
 * stays agnostic to storage/registration.
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
    header.identityKey ||
    header.ephemeralKey ||
    header.oneTimePrekeyId !== undefined,
  );
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * React Native has no guaranteed TextEncoder; noble's `utf8ToBytes` covers
 * encoding. Expo's winter runtime installs TextDecoder, created lazily so the
 * module never depends on load order.
 */
function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Real RatchetEngine over @noble/curves + @noble/ciphers. `LocalKeyMaterial`
 * is sourced by `lib/e2e/device.ts` (identity store + server registration).
 */
export function createSignalEngine(
  myKeys: LocalKeyMaterial,
  meta: { userId: string | null; deviceId: string | null } = {
    userId: null,
    deviceId: null,
  },
): RatchetEngine {
  const identityLength = myKeys.identity.publicKey.length;

  /**
   * associatedData = initiator identity ‖ responder identity (x3dh.ts). The
   * half that isn't mine is the peer's — no extra session field needed.
   */
  function remoteIdentityOf(session: DrSession): string {
    const ad = session.associatedData;
    const first = ad.slice(0, identityLength);
    const second = ad.slice(identityLength);
    return bytesToBase64(
      bytesEqual(first, myKeys.identity.publicKey) ? second : first,
    );
  }

  async function decryptBytes(
    session: RatchetSession | null,
    header: E2eHeader,
    ciphertext: string,
  ): Promise<DecryptBytesResult> {
    let drSession: DrSession;

    if (isNewSessionHeader(header)) {
      if (
        !header.identityKey ||
        !header.ephemeralKey ||
        header.signedPrekeyId === undefined
      )
        throw new Error("new-session header missing required X3DH fields");

      const signedPrekey = myKeys.getSignedPrekey(header.signedPrekeyId);
      if (!signedPrekey)
        throw new Error(`unknown signed prekey id ${header.signedPrekeyId}`);

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
      if (!session)
        throw new Error("no session, and header carries no X3DH init fields");
      drSession = session as unknown as DrSession;
    }

    const result = ratchetDecrypt(drSession, header, base64ToBytes(ciphertext));
    return {
      plaintext: result.plaintext,
      session: result.session as unknown as RatchetSession,
    };
  }

  async function encryptBytes(
    session: RatchetSession | null,
    plaintext: Uint8Array,
    bundle?: RemoteKeyBundle,
  ): Promise<EncryptBytesResult> {
    let drSession: DrSession;
    let x3dhFields: Pick<
      E2eHeader,
      "identityKey" | "ephemeralKey" | "oneTimePrekeyId" | "signedPrekeyId"
    > = {};

    if (session) {
      drSession = session as unknown as DrSession;
    } else {
      if (!bundle)
        throw new Error("no session and no bundle to start one from");
      const { session: newSession, ephemeralPublicKey } = x3dhInitiate(
        myKeys.identity,
        bundle,
      );
      drSession = newSession;
      x3dhFields = {
        identityKey: bytesToBase64(myKeys.identity.publicKey),
        ephemeralKey: bytesToBase64(ephemeralPublicKey),
        signedPrekeyId: bundle.signedPrekeyId,
        ...(bundle.oneTimePrekey
          ? { oneTimePrekeyId: bundle.oneTimePrekey.prekeyId }
          : {}),
      };
    }

    const result = ratchetEncrypt(drSession, plaintext);
    const header: E2eHeader = { v: 1, ...result.header, ...x3dhFields };

    return {
      header,
      ciphertext: bytesToBase64(result.ciphertext),
      session: result.session as unknown as RatchetSession,
      remoteIdentityKey: remoteIdentityOf(result.session),
    };
  }

  return {
    userId: meta.userId,
    deviceId: meta.deviceId,
    decryptBytes,
    encryptBytes,

    async decrypt(session, header, ciphertext) {
      const result = await decryptBytes(session, header, ciphertext);
      return {
        plaintext: decodeUtf8(result.plaintext),
        session: result.session,
      };
    },

    async encrypt(session, plaintext, bundle) {
      return encryptBytes(session, utf8ToBytes(plaintext), bundle);
    },
  };
}
