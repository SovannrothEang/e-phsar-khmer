/**
 * Failure codes that mean "we gave up waiting", not "the provider said no".
 * An attempt failed this way may still have been paid — Bakong has no webhook
 * and its poll chain can die — so the reconciler keeps asking about it for a
 * grace window and settles it if the money turns out to have arrived.
 *
 * Deliberately excludes `CHARGE_GATEWAY_ERROR` (no QR/charge ever existed, so
 * there is nothing a payer could have paid) and `PROVIDER_NOT_REGISTERED` /
 * `GATEWAY_NOT_CONFIGURED` (config problems the reconciler cannot resolve).
 */
export const RECOVERABLE_FAILURE_CODES = [
  'POLL_EXPIRED',
  'POLL_GATEWAY_ERROR',
] as const;

export interface ReconcilableAttempt {
  status: 'pending' | 'succeeded' | 'failed';
  failureCode: string | null;
}

/** Whether asking the provider about this attempt can still change anything. */
export function isReconcilable(attempt: ReconcilableAttempt): boolean {
  if (attempt.status === 'pending') return true;
  return (
    attempt.status === 'failed' &&
    (RECOVERABLE_FAILURE_CODES as readonly string[]).includes(
      attempt.failureCode ?? '',
    )
  );
}

export interface DueOptions {
  /** Attempts younger than this are checked on every tick. */
  fastWindowMs: number;
  /** Older ones only on every Nth tick, so the long grace tail stays cheap. */
  slowEveryTicks: number;
}

/** Whether an attempt of this age is due for a check on this tick. */
export function isDueThisTick(
  ageMs: number,
  tick: number,
  options: DueOptions,
): boolean {
  if (ageMs < options.fastWindowMs) return true;
  return tick % options.slowEveryTicks === 0;
}
