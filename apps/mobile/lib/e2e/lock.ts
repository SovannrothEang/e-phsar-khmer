/**
 * The web serializes v2 sends with a Web Lock (and v1 by conversation).
 * React Native has one JS thread, but async interleaving can still read the
 * same ratchet session twice — every E2E operation that reads then writes
 * session state runs through this single chain.
 */
let tail: Promise<unknown> = Promise.resolve();

export function withE2eLock<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
