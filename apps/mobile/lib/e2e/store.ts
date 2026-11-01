import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { decodeSession, encodeSession } from "./session-codec";
import type { RatchetSession } from "./types";

/**
 * Persistence split:
 * - SecureStore (values ≤ 2,048 B): the long-term identity and each one-time
 *   prekey's private half. OS-keystore protected, and each item is small.
 * - AsyncStorage (no size cap): ratchet sessions and decrypted plaintext.
 *   These are the mobile equivalent of the web's IndexedDB store.
 */

const IDENTITY_PREFIX = "e2e_identity_";
const OTP_PREFIX = "e2e_otp_";
const SESSION_PREFIX = "e2e_session_";
const MESSAGE_PREFIX = "e2e_msg_";
const RESTORED_PREFIX = "e2e_restored_";

export interface StoredKeyPair {
  publicKey: string;
  secretKey: string;
}

export interface StoredPrekey {
  id: number;
  key: StoredKeyPair;
}

export interface StoredIdentity {
  userId: string;
  registrationId: number;
  identity: StoredKeyPair;
  signing: StoredKeyPair;
  signedPrekey: { id: number; key: StoredKeyPair };
  signedPrekeySignature: string;
  nextPrekeyId: number;
  /** v2 device id from POST /chats/e2e/devices. */
  deviceId?: string;
  /** base64 account backup key (BK), once this device has it. */
  backupKey?: string;
  /** Last backup segment cursor pulled into the restored cache. */
  backupCursor?: string;
}

function identityKey(userId: string): string {
  return `${IDENTITY_PREFIX}${userId}`;
}

function prekeyKey(userId: string, id: number): string {
  return `${OTP_PREFIX}${userId}_${id}`;
}

function sessionKey(
  userId: string,
  peerUserId: string,
  peerDeviceId: string,
): string {
  return `${SESSION_PREFIX}${userId}:${peerUserId}:${peerDeviceId}`;
}

function messageKey(messageId: string): string {
  return `${MESSAGE_PREFIX}${messageId}`;
}

function restoredKey(messageId: string): string {
  return `${RESTORED_PREFIX}${messageId}`;
}

export async function loadIdentity(
  userId: string,
): Promise<StoredIdentity | null> {
  try {
    const raw = await SecureStore.getItemAsync(identityKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredIdentity;
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  await SecureStore.setItemAsync(
    identityKey(identity.userId),
    JSON.stringify(identity),
  );
}

/** Persist private prekey halves BEFORE uploading their public halves. */
export async function savePrekeys(
  userId: string,
  prekeys: StoredPrekey[],
): Promise<void> {
  await Promise.all(
    prekeys.map((prekey) =>
      SecureStore.setItemAsync(
        prekeyKey(userId, prekey.id),
        JSON.stringify(prekey),
      ),
    ),
  );
}

export async function loadPrekey(
  userId: string,
  id: number,
): Promise<StoredPrekey | null> {
  try {
    const raw = await SecureStore.getItemAsync(prekeyKey(userId, id));
    if (!raw) return null;
    return JSON.parse(raw) as StoredPrekey;
  } catch {
    return null;
  }
}

export async function getDeviceSession(
  userId: string,
  peerUserId: string,
  peerDeviceId: string,
): Promise<RatchetSession | null> {
  try {
    const raw = await AsyncStorage.getItem(
      sessionKey(userId, peerUserId, peerDeviceId),
    );
    return decodeSession(raw);
  } catch {
    return null;
  }
}

export async function saveDeviceSessions(
  userId: string,
  sessions: {
    peerUserId: string;
    peerDeviceId: string;
    session: RatchetSession;
  }[],
): Promise<void> {
  if (sessions.length === 0) return;
  await AsyncStorage.multiSet(
    sessions.map((entry) => [
      sessionKey(userId, entry.peerUserId, entry.peerDeviceId),
      encodeSession(entry.session),
    ]),
  );
}

export async function getDecrypted(messageId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(messageKey(messageId));
  } catch {
    return null;
  }
}

export async function saveDecrypted(
  messageId: string,
  plaintext: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(messageKey(messageId), plaintext);
  } catch {
    /* cache write failure must not fail the render */
  }
}

/** Plaintext restored from the account backup (a fallback when no key exists). */
export async function getRestored(messageId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(restoredKey(messageId));
  } catch {
    return null;
  }
}

export async function saveRestored(
  items: { messageId: string; plaintext: string }[],
): Promise<void> {
  if (items.length === 0) return;
  try {
    await AsyncStorage.multiSet(
      items.map((item) => [restoredKey(item.messageId), item.plaintext]),
    );
  } catch {
    /* keep the rest of the restore usable */
  }
}
