import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Header that carries the shared secret for the internal maintenance routes
 * (`POST /internal/payments/reconcile`, `POST /internal/jobs/run`).
 */
export const SECRET_HEADER = 'x-internal-secret';

/**
 * Compares two secrets without leaking length or content through timing:
 * both sides are hashed to a fixed 32 bytes first. A plain
 * `timingSafeEqual(Buffer.from(a), Buffer.from(b))` would throw on a length
 * mismatch and is only constant-time for equal-length inputs.
 */
export function secretMatches(received: string, expected: string): boolean {
  const a = createHash('sha256').update(received).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
