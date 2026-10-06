import { signChatAttachments } from "@/actions/chat-attachments";
import type { AttachmentMeta } from "./content";
import { decryptFile } from "./format";
import { getCachedFile, putCachedFile } from "./store";

/**
 * Receive side (plan §5): local cache → batched signed URL → fetch → hash
 * check → decrypt → cache. One signing call covers every attachment that
 * asks within the same short window (a page of history renders many at once).
 */

const BATCH_WINDOW_MS = 25;
const SIGN_MAX_IDS = 50;
/** Re-sign this long before the server-side expiry. */
const EXPIRY_MARGIN_MS = 30_000;

const signed = new Map<string, { url: string; expiresAt: number }>();
const queue: {
  id: string;
  resolve: (url: string | null) => void;
  reject: (e: Error) => void;
}[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = queue.splice(0, SIGN_MAX_IDS);
  if (queue.length > 0) timer = setTimeout(flush, 0);
  const ids = [...new Set(batch.map((b) => b.id))];
  const res = await signChatAttachments(ids);
  if (!res.ok) {
    for (const b of batch) b.reject(new Error(res.message));
    return;
  }
  for (const u of res.data)
    signed.set(u.id, { url: u.url, expiresAt: Date.parse(u.expiresAt) });
  // Ids the server left out are ones this user may not read.
  for (const b of batch) b.resolve(signed.get(b.id)?.url ?? null);
}

function signedUrl(id: string, fresh = false): Promise<string | null> {
  const hit = signed.get(id);
  if (!fresh && hit && hit.expiresAt - EXPIRY_MARGIN_MS > Date.now())
    return Promise.resolve(hit.url);
  signed.delete(id);
  return new Promise((resolve, reject) => {
    queue.push({ id, resolve, reject });
    timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  });
}

async function fetchBlob(id: string): Promise<Uint8Array<ArrayBuffer>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = await signedUrl(id, attempt > 0);
    if (!url) throw new Error("attachment unavailable");
    const res = await fetch(url);
    // An expired/revoked link: re-sign once.
    if (res.status === 400 || res.status === 403) continue;
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error("attachment link expired");
}

const inFlight = new Map<
  string,
  Promise<{ bytes: ArrayBuffer; mime: string }>
>();

/** Decrypted bytes for one attachment, downloading at most once per device. */
export function loadAttachment(
  meta: AttachmentMeta,
): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const running = inFlight.get(meta.id);
  if (running) return running;
  const job = (async () => {
    const cached = await getCachedFile(meta.id).catch(() => null);
    if (cached) return cached;
    const blob = await fetchBlob(meta.id);
    const plain = await decryptFile(
      blob,
      meta.key,
      meta.id,
      meta.ciphertextHash,
    );
    const file = { bytes: plain.buffer, mime: meta.mime };
    await putCachedFile(meta.id, file.bytes, file.mime).catch(() => undefined);
    return file;
  })().finally(() => inFlight.delete(meta.id));
  inFlight.set(meta.id, job);
  return job;
}
