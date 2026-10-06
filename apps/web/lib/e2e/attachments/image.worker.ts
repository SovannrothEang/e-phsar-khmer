/// <reference lib="webworker" />
import { processImage } from "./image";

// One request per message: { id, file } → { id, ok, result | error }.
self.onmessage = async (event: MessageEvent<{ id: number; file: Blob }>) => {
  const { id, file } = event.data;
  try {
    const result = await processImage(file);
    (self as unknown as Worker).postMessage({ id, ok: true, result }, [
      result.bytes,
    ]);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : "image processing failed",
    });
  }
};
