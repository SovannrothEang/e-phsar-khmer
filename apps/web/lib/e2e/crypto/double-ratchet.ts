import {
  aeadDecrypt,
  aeadEncrypt,
  concatBytes,
  dh,
  generateX25519KeyPair,
  kdfChainKey,
  kdfRootKey,
  u32be,
} from "./primitives";
import type { KeyPair } from "./primitives";
import { base64ToBytes, bytesToBase64 } from "./base64";

/** Bounded skipped-key retention — Signal's own reference implementation uses the same cap. */
const MAX_SKIP = 1000;

export interface RatchetHeader {
  dh: string;
  pn: number;
  n: number;
}

/**
 * signal.org/docs/specifications/doubleratchet, §2-3. Field names follow the
 * spec's own (RK, DHs, DHr, CKs, CKr, Ns, Nr, PN) so this is auditable
 * against it directly.
 */
export interface DrSession {
  rootKey: Uint8Array;
  dhSelf: KeyPair;
  dhRemote: Uint8Array | null;
  sendChainKey: Uint8Array | null;
  recvChainKey: Uint8Array | null;
  sendN: number;
  recvN: number;
  prevSendN: number;
  /** `${base64 dhRemote}:${n}` -> message key. Bounded by MAX_SKIP entries per ratchet step. */
  skipped: Record<string, Uint8Array>;
  /** Fixed for the session's lifetime: concat(initiator identity pub, responder identity pub). */
  associatedData: Uint8Array;
}

/**
 * The X3DH initiator's side of session setup (spec: RatchetInitAlice).
 * `remoteDhPublic` is the responder's signed prekey — the initiator has no
 * other DH-capable public key from them yet, so the very first ratchet step
 * runs against it immediately, before any message is sent.
 */
export function ratchetInitSender(
  rootKey: Uint8Array,
  remoteDhPublic: Uint8Array,
  associatedData: Uint8Array,
): DrSession {
  const dhSelf = generateX25519KeyPair();
  const [newRootKey, sendChainKey] = kdfRootKey(rootKey, dh(dhSelf.secretKey, remoteDhPublic));
  return {
    rootKey: newRootKey,
    dhSelf,
    dhRemote: remoteDhPublic,
    sendChainKey,
    recvChainKey: null,
    sendN: 0,
    recvN: 0,
    prevSendN: 0,
    skipped: {},
    associatedData,
  };
}

/**
 * The X3DH responder's side (spec: RatchetInitBob). `dhSelf` is the
 * responder's OWN signed-prekey keypair, reused as their first ratchet
 * keypair — they generate a fresh one only once they first need to send,
 * triggered by processing the initiator's first message (see
 * `ratchetDecrypt`'s DH-ratchet step).
 */
export function ratchetInitReceiver(
  rootKey: Uint8Array,
  dhSelf: KeyPair,
  associatedData: Uint8Array,
): DrSession {
  return {
    rootKey,
    dhSelf,
    dhRemote: null,
    sendChainKey: null,
    recvChainKey: null,
    sendN: 0,
    recvN: 0,
    prevSendN: 0,
    skipped: {},
    associatedData,
  };
}

function headerAad(
  session: Pick<DrSession, "associatedData">,
  dhPublic: Uint8Array,
  pn: number,
  n: number,
): Uint8Array {
  return concatBytes(session.associatedData, dhPublic, u32be(pn), u32be(n));
}

export function ratchetEncrypt(
  session: DrSession,
  plaintext: Uint8Array,
): { header: RatchetHeader; ciphertext: Uint8Array; session: DrSession } {
  if (!session.sendChainKey)
    throw new Error(
      "cannot send: no sending chain yet (we're the X3DH responder and haven't received a message to ratchet forward from)",
    );

  const [nextChainKey, messageKey] = kdfChainKey(session.sendChainKey);
  const header: RatchetHeader = {
    dh: bytesToBase64(session.dhSelf.publicKey),
    pn: session.prevSendN,
    n: session.sendN,
  };
  const aad = headerAad(session, session.dhSelf.publicKey, header.pn, header.n);
  const ciphertext = aeadEncrypt(messageKey, plaintext, aad);

  return {
    header,
    ciphertext,
    session: { ...session, sendChainKey: nextChainKey, sendN: session.sendN + 1 },
  };
}

export function ratchetDecrypt(
  session: DrSession,
  header: RatchetHeader,
  ciphertext: Uint8Array,
): { plaintext: Uint8Array; session: DrSession } {
  const dhPublic = base64ToBytes(header.dh);
  const skipKey = `${header.dh}:${header.n}`;

  // Idempotency lives one layer up (decrypt-message.ts, by message id), but
  // an out-of-order message we already skipped past is looked up here by
  // (sender ratchet key, n) instead of re-deriving it from the chain.
  const cachedKey = session.skipped[skipKey];
  if (cachedKey) {
    const remaining = { ...session.skipped };
    delete remaining[skipKey];
    const aad = headerAad(session, dhPublic, header.pn, header.n);
    return {
      plaintext: aeadDecrypt(cachedKey, ciphertext, aad),
      session: { ...session, skipped: remaining },
    };
  }

  let working = session;
  const isNewRatchetKey = !session.dhRemote || bytesToBase64(session.dhRemote) !== header.dh;

  if (isNewRatchetKey) {
    // Messages still in flight on the OLD chain when the sender moved on —
    // cache their keys now, or they become permanently undecryptable.
    working = skipMessageKeys(working, header.pn);
    working = dhRatchetStep(working, dhPublic);
  }

  // Out-of-order arrival within the (possibly just-ratcheted) current chain.
  working = skipMessageKeys(working, header.n);

  if (!working.recvChainKey) throw new Error("no receiving chain established");
  const [nextChainKey, messageKey] = kdfChainKey(working.recvChainKey);
  const aad = headerAad(working, dhPublic, header.pn, header.n);
  const plaintext = aeadDecrypt(messageKey, ciphertext, aad);

  return {
    plaintext,
    session: { ...working, recvChainKey: nextChainKey, recvN: header.n + 1 },
  };
}

function skipMessageKeys(session: DrSession, until: number): DrSession {
  if (!session.recvChainKey || until <= session.recvN) return session;
  if (until - session.recvN > MAX_SKIP)
    throw new Error(`refusing to skip ${until - session.recvN} message keys (max ${MAX_SKIP})`);

  let chainKey = session.recvChainKey;
  const skipped = { ...session.skipped };
  const dhKey = session.dhRemote ? bytesToBase64(session.dhRemote) : "";
  for (let n = session.recvN; n < until; n++) {
    const [nextChainKey, messageKey] = kdfChainKey(chainKey);
    skipped[`${dhKey}:${n}`] = messageKey;
    chainKey = nextChainKey;
  }
  return { ...session, recvChainKey: chainKey, recvN: until, skipped };
}

function dhRatchetStep(session: DrSession, remoteDhPublic: Uint8Array): DrSession {
  const [rootAfterRecv, recvChainKey] = kdfRootKey(
    session.rootKey,
    dh(session.dhSelf.secretKey, remoteDhPublic),
  );
  const dhSelf = generateX25519KeyPair();
  const [rootAfterSend, sendChainKey] = kdfRootKey(
    rootAfterRecv,
    dh(dhSelf.secretKey, remoteDhPublic),
  );
  return {
    ...session,
    rootKey: rootAfterSend,
    dhSelf,
    dhRemote: remoteDhPublic,
    sendChainKey,
    recvChainKey,
    prevSendN: session.sendN,
    sendN: 0,
    recvN: 0,
  };
}
