import type { E2eStore, RatchetSession } from "./types";

// v1 database: per-conversation sessions + plaintext cache. Never modified
// in shape — history written by the single-device build must keep reading.
const DB_NAME = "npic-e2e";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions"; // keyPath: conversationId
const DECRYPTED_STORE = "decrypted"; // keyPath: messageId

// v2 database: per-peer-device sessions + plaintext cache for v2 messages.
// A separate database (not a DB_VERSION bump on the v1 one) so that opening
// it never blocks on — or is blocked by — a still-open tab of the old build
// holding a v1 connection (an IndexedDB upgrade waits for every other
// connection to close).
const V2_DB_NAME = "npic-e2e-v2";
const V2_DB_VERSION = 1;
const DEVICE_SESSIONS_STORE = "deviceSessions"; // keyPath: peerKey

/** v2 session key: one Double Ratchet session per (peer user, peer device). */
export function peerKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`;
}

function open(
  name: string,
  version: number,
  stores: [name: string, keyPath: string][],
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [store, keyPath] of stores)
        if (!db.objectStoreNames.contains(store))
          db.createObjectStore(store, { keyPath });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return open(DB_NAME, DB_VERSION, [
    [SESSIONS_STORE, "conversationId"],
    [DECRYPTED_STORE, "messageId"],
  ]);
}

function openV2Db(): Promise<IDBDatabase> {
  return open(V2_DB_NAME, V2_DB_VERSION, [
    [DEVICE_SESSIONS_STORE, "peerKey"],
    [DECRYPTED_STORE, "messageId"],
  ]);
}

// History-backup database (own DB for the same no-upgrade reason as v2).
// `uploaded`: message ids this device already pushed into the backup.
// `restored`: plaintext pulled FROM the backup. Kept apart from `decrypted`
// on purpose — a restored copy is only a fallback, consulted after this
// device's own decrypt fails. Treating it as a normal cache hit would skip
// the ratchet on a message addressed to this device (e.g. an X3DH first
// message) and break every later message in that session.
const BACKUP_DB_NAME = "npic-e2e-backup";
const BACKUP_DB_VERSION = 1;
const UPLOADED_STORE = "uploaded"; // keyPath: messageId
const RESTORED_STORE = "restored"; // keyPath: messageId

function openBackupDb(): Promise<IDBDatabase> {
  return open(BACKUP_DB_NAME, BACKUP_DB_VERSION, [
    [UPLOADED_STORE, "messageId"],
    [RESTORED_STORE, "messageId"],
  ]);
}

export interface PlaintextItem {
  messageId: string;
  plaintext: string;
}

/** Every plaintext this device decrypted or sent itself (v1 + v2 caches). */
export async function listLocalPlaintext(): Promise<PlaintextItem[]> {
  const all = async (db: IDBDatabase) => {
    const tx = db.transaction(DECRYPTED_STORE, "readonly");
    return reqToPromise<PlaintextItem[]>(
      tx.objectStore(DECRYPTED_STORE).getAll(),
    );
  };
  const [v1, v2] = await Promise.all([
    all(await openDb()),
    all(await openV2Db()),
  ]);
  return [...v1, ...v2];
}

export async function listUploadedIds(): Promise<Set<string>> {
  const db = await openBackupDb();
  const tx = db.transaction(UPLOADED_STORE, "readonly");
  const keys = await reqToPromise(tx.objectStore(UPLOADED_STORE).getAllKeys());
  return new Set(keys as string[]);
}

export async function markUploaded(messageIds: string[]): Promise<void> {
  const db = await openBackupDb();
  const tx = db.transaction(UPLOADED_STORE, "readwrite");
  const store = tx.objectStore(UPLOADED_STORE);
  for (const messageId of messageIds) store.put({ messageId });
  await txDone(tx);
}

/** Store restored plaintext; marks it uploaded too (it's already in the backup). */
export async function saveRestored(items: PlaintextItem[]): Promise<void> {
  const db = await openBackupDb();
  const tx = db.transaction([RESTORED_STORE, UPLOADED_STORE], "readwrite");
  const restored = tx.objectStore(RESTORED_STORE);
  const uploaded = tx.objectStore(UPLOADED_STORE);
  for (const item of items) {
    restored.put(item);
    uploaded.put({ messageId: item.messageId });
  }
  await txDone(tx);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getDecryptedFrom(
  db: IDBDatabase,
  messageId: string,
): Promise<string | null> {
  const tx = db.transaction(DECRYPTED_STORE, "readonly");
  const row = await reqToPromise<
    { messageId: string; plaintext: string } | undefined
  >(tx.objectStore(DECRYPTED_STORE).get(messageId));
  return row?.plaintext ?? null;
}

/**
 * Real IndexedDB-backed store: Double Ratchet session state and decrypted
 * plaintext, both keyed for idempotent lookup. Private keys and ratchet
 * state never leave the browser — this is the only place they're written
 * to disk.
 */
export function createIndexedDbStore(): E2eStore {
  return {
    async getSession(conversationId) {
      const db = await openDb();
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const row = await reqToPromise<
        { conversationId: string; session: RatchetSession } | undefined
      >(tx.objectStore(SESSIONS_STORE).get(conversationId));
      return row?.session ?? null;
    },

    async getDecrypted(messageId) {
      // v2 first (every new message lands there), then the v1 cache.
      const fromV2 = await getDecryptedFrom(await openV2Db(), messageId);
      if (fromV2 !== null) return fromV2;
      return getDecryptedFrom(await openDb(), messageId);
    },

    async commit(conversationId, session, messageId, plaintext) {
      const db = await openDb();
      const tx = db.transaction([SESSIONS_STORE, DECRYPTED_STORE], "readwrite");
      tx.objectStore(SESSIONS_STORE).put({ conversationId, session });
      tx.objectStore(DECRYPTED_STORE).put({ messageId, plaintext });
      await txDone(tx);
    },

    async getDeviceSession(key) {
      const db = await openV2Db();
      const tx = db.transaction(DEVICE_SESSIONS_STORE, "readonly");
      const row = await reqToPromise<
        { peerKey: string; session: RatchetSession } | undefined
      >(tx.objectStore(DEVICE_SESSIONS_STORE).get(key));
      return row?.session ?? null;
    },

    async getRestored(messageId) {
      const db = await openBackupDb();
      const tx = db.transaction(RESTORED_STORE, "readonly");
      const row = await reqToPromise<PlaintextItem | undefined>(
        tx.objectStore(RESTORED_STORE).get(messageId),
      );
      return row?.plaintext ?? null;
    },

    async commitSessions(sessions) {
      const db = await openV2Db();
      const tx = db.transaction(DEVICE_SESSIONS_STORE, "readwrite");
      const store = tx.objectStore(DEVICE_SESSIONS_STORE);
      for (const { peerKey: key, session } of sessions)
        store.put({ peerKey: key, session });
      await txDone(tx);
    },

    async commitDevice(sessions, messageId, plaintext) {
      const db = await openV2Db();
      const tx = db.transaction(
        [DEVICE_SESSIONS_STORE, DECRYPTED_STORE],
        "readwrite",
      );
      const store = tx.objectStore(DEVICE_SESSIONS_STORE);
      for (const { peerKey: key, session } of sessions)
        store.put({ peerKey: key, session });
      tx.objectStore(DECRYPTED_STORE).put({ messageId, plaintext });
      await txDone(tx);
    },
  };
}
