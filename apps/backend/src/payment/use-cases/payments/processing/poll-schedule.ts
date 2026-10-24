/** Hard ceiling on the gap between two poll rounds, whatever the base interval. */
export const MAX_POLL_DELAY_MS = 30_000;

/** Rounds polled at the base interval before the first back-off step. */
const FAST_ROUNDS = 5;
/** Rounds (counted from zero) after which the interval is quadrupled. */
const SLOW_AFTER_ROUND = 10;
/** The last round lands this long after the deadline, so a late payer still settles. */
const EXPIRY_SLACK_MS = 1_000;

export interface PollDelayInput {
  /** The provider's configured interval (`ChargeResult.poll.intervalMs`). */
  baseMs: number;
  /** Rounds already run for this attempt. Absent on payloads queued before back-off existed. */
  round: number | undefined;
  /** Epoch ms after which the checkout is dead. */
  expiresAt: number;
  now: number;
}

/**
 * How long to wait before the next "ask the gateway again" round.
 *
 * A payer usually scans within the first minute, so the early rounds stay
 * tight; a QR left open then costs ~25 rounds instead of one every 4 s for
 * the full 5 minutes. `PaymentReconciler` is the guarantee behind this chain,
 * so a slower tail only delays the fast path — it never strands a payment.
 */
export function nextPollDelayMs(input: PollDelayInput): number {
  const round = input.round ?? 0;

  let delay = input.baseMs;
  if (round >= SLOW_AFTER_ROUND) delay = input.baseMs * 4;
  else if (round >= FAST_ROUNDS) delay = input.baseMs * 2;
  delay = Math.min(delay, Math.max(MAX_POLL_DELAY_MS, input.baseMs));

  // Never sleep past the deadline: one final round just after it asks the
  // provider a last time, then the use-case marks the attempt expired.
  const untilExpiry = input.expiresAt - input.now + EXPIRY_SLACK_MS;
  return Math.max(0, Math.min(delay, untilExpiry));
}
