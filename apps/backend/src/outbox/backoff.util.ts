export interface BackoffOptions {
  baseMs: number;
  factor: number;
  maxMs: number;
}

/**
 * Exponential backoff for the *nth* attempt, where `attempts` is the count
 * already spent (a row claimed for the first time arrives here with 1).
 *
 * Pure, and deliberately not jittered: rows are claimed by
 * `FOR UPDATE SKIP LOCKED` in `available_at` order, so two dispatchers
 * never contend for the same row and there is no thundering herd for
 * jitter to spread out.
 */
export function computeBackoffMs(
  attempts: number,
  { baseMs, factor, maxMs }: BackoffOptions,
): number {
  const exponent = Math.max(0, attempts - 1);
  const delay = baseMs * Math.pow(factor, exponent);
  return Math.min(Math.round(delay), maxMs);
}
