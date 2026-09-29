import { processImage } from "./image";
import type { PreparedImage } from "./image";

/**
 * Resize + re-encode off the main thread so a 12 MP photo doesn't freeze
 * the composer. Falls back to the main thread where a worker (or
 * OffscreenCanvas inside it) isn't available.
 */

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (r: PreparedImage) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (typeof OffscreenCanvas === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./image.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      e: MessageEvent<
        | { id: number; ok: true; result: PreparedImage }
        | { id: number; ok: false; error: string }
      >,
    ) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.ok) job.resolve(e.data.result);
      else job.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      // Worker failed to load/run: fail pending jobs, use the main thread.
      workerBroken = true;
      for (const job of pending.values())
        job.reject(new Error("image worker failed"));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const w = getWorker();
  if (!w) return processImage(file);
  const id = ++seq;
  try {
    return await new Promise<PreparedImage>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ id, file });
    });
  } catch {
    // A worker-side failure (e.g. no 2d context in workers) — retry here.
    return processImage(file);
  }
}
