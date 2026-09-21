import { concatBytes, dh, generateX25519KeyPair, kdfX3dh, verify } from "./primitives";
import type { KeyPair } from "./primitives";
import { base64ToBytes } from "./base64";
import { ratchetInitReceiver, ratchetInitSender } from "./double-ratchet";
import type { DrSession } from "./double-ratchet";
import type { RemoteKeyBundle } from "../types";

export class BundleSignatureError extends Error {
  constructor() {
    super("signed prekey signature does not verify against the bundle's identity signing key");
  }
}

/**
 * The X3DH initiator's ("Alice's") shared-secret computation
 * (signal.org/docs/specifications/x3dh, §3.3), handed straight into the
 * Double Ratchet's own init step — X3DH's output is never used for
 * anything else, the two specs compose this way by design.
 *
 * Throws BundleSignatureError before doing any DH work if the bundle's
 * signed prekey doesn't verify against its identity signing key — a
 * tampered or corrupted bundle must never silently produce a session.
 */
export function x3dhInitiate(
  myIdentity: KeyPair,
  theirBundle: RemoteKeyBundle,
): { session: DrSession; ephemeralPublicKey: Uint8Array } {
  const theirIdentityPub = base64ToBytes(theirBundle.identityKey);
  const theirSigningPub = base64ToBytes(theirBundle.identitySigningKey);
  const theirSpkPub = base64ToBytes(theirBundle.signedPrekeyPublic);
  const signature = base64ToBytes(theirBundle.signedPrekeySignature);

  if (!verify(signature, theirSpkPub, theirSigningPub)) throw new BundleSignatureError();

  const ephemeral = generateX25519KeyPair();
  const dh1 = dh(myIdentity.secretKey, theirSpkPub);
  const dh2 = dh(ephemeral.secretKey, theirIdentityPub);
  const dh3 = dh(ephemeral.secretKey, theirSpkPub);
  const dh4 = theirBundle.oneTimePrekey
    ? dh(ephemeral.secretKey, base64ToBytes(theirBundle.oneTimePrekey.publicKey))
    : new Uint8Array(0);

  const sharedSecret = kdfX3dh(concatBytes(dh1, dh2, dh3, dh4), "npic-e2e-x3dh");
  const associatedData = concatBytes(myIdentity.publicKey, theirIdentityPub);
  const session = ratchetInitSender(sharedSecret, theirSpkPub, associatedData);

  return { session, ephemeralPublicKey: ephemeral.publicKey };
}

/**
 * The X3DH responder's ("Bob's") side — mirrors x3dhInitiate's DH terms
 * using the responder's own key material. `myOneTimePrekey` must be null
 * exactly when the initiator's header carried no `oneTimePrekeyId`; passing
 * one when the initiator didn't use one (or vice versa) desyncs the shared
 * secret, since DH4's presence/absence is part of what's being agreed on.
 */
export function x3dhRespond(
  myIdentity: KeyPair,
  mySignedPrekey: KeyPair,
  myOneTimePrekey: KeyPair | null,
  theirIdentityPublicKey: Uint8Array,
  theirEphemeralPublicKey: Uint8Array,
): DrSession {
  const dh1 = dh(mySignedPrekey.secretKey, theirIdentityPublicKey);
  const dh2 = dh(myIdentity.secretKey, theirEphemeralPublicKey);
  const dh3 = dh(mySignedPrekey.secretKey, theirEphemeralPublicKey);
  const dh4 = myOneTimePrekey
    ? dh(myOneTimePrekey.secretKey, theirEphemeralPublicKey)
    : new Uint8Array(0);

  const sharedSecret = kdfX3dh(concatBytes(dh1, dh2, dh3, dh4), "npic-e2e-x3dh");
  const associatedData = concatBytes(theirIdentityPublicKey, myIdentity.publicKey);
  return ratchetInitReceiver(sharedSecret, mySignedPrekey, associatedData);
}
