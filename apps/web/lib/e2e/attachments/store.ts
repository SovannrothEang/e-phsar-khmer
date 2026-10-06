import type { AttachmentMeta } from "./content";

/**
 * IndexedDB for attachments, in its own database (same no-upgrade reason as
 * `npic-e2e-v2`, see ../store.ts):
 *   outbox — a send in progress: encrypted blobs + metadata, keyed by
 *            clientMessageId, so a reload or crash resumes it with the same
 *            ids instead of losing it (plan §5 step 3).
 *   files  — decrypted file bytes, keyed by attachment id, so a file is
 *            downloaded and decrypted once per device (LRU-capped).
 * Like every other E2E store, contents are readable by anyone with access
 * to this browser profile.
 */

const DB_NAME = "npic-e2e-files";
const DB_VERSION = 1;
const OUTBOX = "outbox";
const FILES = "files";
/** Decrypted-file cache budget; oldest-used entries are evicted past it. */
const FILES_CACHE_MAX_BYTES = 200 * 1024 * 1024;

export interface OutboxAttachment {
  meta: AttachmentMeta;
  /** E2E_FILE_V1 blob, exactly as uploaded. */
  blob: ArrayBuffer;
  uploaded: boolean;
}

export interface OutboxEntry {
  clientMessageId: string;
  recipientId: string;
  conversationId: string | null;
  listingId?: string;
  text?: string;
  attachments: OutboxAttachment[];
  createdAt: number;
}

interface CachedFile {
  id: string;
  bytes: ArrayBuffer;
  mime: string;
  size: number;
  lastUsed: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX))
        db.createObjectStore(OUTBOX, { keyPath: "clientMessageId" });
      if (!db.objectStoreNames.contains(FILES))
        db.createObjectStore(FILES, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

// ── Outbox ─────────────────────────────────────────────────────────────────

export async function putOutbox(entry: OutboxEntry): Promise<void> {
  await run(OUTBOX, "readwrite", (s) => s.put(entry));
}

export async function getOutbox(
  clientMessageId: string,
): Promise<OutboxEntry | null> {
  const hit = (await run<OutboxEntry>(OUTBOX, "readonly", (s) =>
    s.get(clientMessageId),
  )) as OutboxEntry | undefined;
  return hit ?? null;
}

export async function deleteOutbox(clientMessageId: string): Promise<void> {
  await run(OUTBOX, "readwrite", (s) => s.delete(clientMessageId));
}

export async function listOutbox(recipientId: string): Promise<OutboxEntry[]> {
  const all = (await run<OutboxEntry[]>(OUTBOX, "readonly", (s) =>
    s.getAll(),
  )) as OutboxEntry[] | undefined;
  return (all ?? [])
    .filter((e) => e.recipientId === recipientId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ── Decrypted file cache ───────────────────────────────────────────────────

export async function getCachedFile(
  id: string,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  const hit = (await run<CachedFile>(FILES, "readonly", (s) => s.get(id))) as
    | CachedFile
    | undefined;
  if (!hit) return null;
  // Touch for LRU; failure to touch is harmless.
  void run(FILES, "readwrite", (s) => s.put({ ...hit, lastUsed: Date.now() }));
  return { bytes: hit.bytes, mime: hit.mime };
}

export async function putCachedFile(
  id: string,
  bytes: ArrayBuffer,
  mime: string,
): Promise<void> {
  await run(FILES, "readwrite", (s) =>
    s.put({
      id,
      bytes,
      mime,
      size: bytes.byteLength,
      lastUsed: Date.now(),
    } satisfies CachedFile),
  );
  void evictOverBudget();
}

async function evictOverBudget(): Promise<void> {
  const all = ((await run<CachedFile[]>(FILES, "readonly", (s) =>
    s.getAll(),
  )) ?? []) as CachedFile[];
  let total = all.reduce((n, f) => n + f.size, 0);
  if (total <= FILES_CACHE_MAX_BYTES) return;
  const victims: string[] = [];
  for (const f of all.sort((a, b) => a.lastUsed - b.lastUsed)) {
    if (total <= FILES_CACHE_MAX_BYTES) break;
    victims.push(f.id);
    total -= f.size;
  }
  await run(FILES, "readwrite", (s) => {
    for (const id of victims) s.delete(id);
  });
}
