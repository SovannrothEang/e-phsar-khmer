import type { E2eStore, RatchetSession } from "./types";

const DB_NAME = "npic-e2e";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions"; // keyPath: conversationId
const DECRYPTED_STORE = "decrypted"; // keyPath: messageId

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE))
        db.createObjectStore(SESSIONS_STORE, { keyPath: "conversationId" });
      if (!db.objectStoreNames.contains(DECRYPTED_STORE))
        db.createObjectStore(DECRYPTED_STORE, { keyPath: "messageId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

/**
 * Real IndexedDB-backed store: Double Ratchet session state and decrypted
 * plaintext, both keyed for idempotent lookup (by conversation, by message
 * id). Private keys and ratchet state never leave the browser — this is
 * the only place they're written to disk.
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
      const db = await openDb();
      const tx = db.transaction(DECRYPTED_STORE, "readonly");
      const row = await reqToPromise<
        { messageId: string; plaintext: string } | undefined
      >(tx.objectStore(DECRYPTED_STORE).get(messageId));
      return row?.plaintext ?? null;
    },

    async commit(conversationId, session, messageId, plaintext) {
      const db = await openDb();
      const tx = db.transaction(
        [SESSIONS_STORE, DECRYPTED_STORE],
        "readwrite",
      );
      tx.objectStore(SESSIONS_STORE).put({ conversationId, session });
      tx.objectStore(DECRYPTED_STORE).put({ messageId, plaintext });
      await txDone(tx);
    },
  };
}
