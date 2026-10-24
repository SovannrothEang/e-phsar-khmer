import { MAX_POLL_DELAY_MS, nextPollDelayMs } from './poll-schedule';

const BASE = 4_000;
const NOW = 1_000_000;
const FAR = NOW + 10 * 60_000;

function delayFor(round: number, expiresAt = FAR): number {
  return nextPollDelayMs({ baseMs: BASE, round, expiresAt, now: NOW });
}

describe('nextPollDelayMs', () => {
  it('polls at the base interval while the QR is fresh', () => {
    expect(delayFor(0)).toBe(BASE);
    expect(delayFor(4)).toBe(BASE);
  });

  it('doubles the interval after the first five rounds, then quadruples it', () => {
    expect(delayFor(5)).toBe(BASE * 2);
    expect(delayFor(9)).toBe(BASE * 2);
    expect(delayFor(10)).toBe(BASE * 4);
    expect(delayFor(40)).toBe(BASE * 4);
  });

  it('never exceeds the hard cap, whatever the base interval is', () => {
    const delay = nextPollDelayMs({
      baseMs: 20_000,
      round: 50,
      expiresAt: FAR,
      now: NOW,
    });
    expect(delay).toBe(MAX_POLL_DELAY_MS);
  });

  it('lands the last round just after expiry instead of overshooting it', () => {
    // 6 s left, next tier would be 16 s: sleep until 1 s past the deadline.
    expect(delayFor(10, NOW + 6_000)).toBe(7_000);
  });

  it('keeps the normal interval when the deadline is further away than it', () => {
    expect(delayFor(0, NOW + 60_000)).toBe(BASE);
  });

  it('falls back to the base interval for a payload queued before rounds existed', () => {
    expect(
      nextPollDelayMs({
        baseMs: BASE,
        round: undefined,
        expiresAt: FAR,
        now: NOW,
      }),
    ).toBe(BASE);
  });

  it('writes a bounded number of rounds across one 5-minute QR', () => {
    let now = NOW;
    const expiresAt = NOW + 300_000;
    let rounds = 0;
    while (now < expiresAt && rounds < 1_000) {
      now += nextPollDelayMs({ baseMs: BASE, round: rounds, expiresAt, now });
      rounds += 1;
    }
    // Was ~75 at a flat 4 s.
    expect(rounds).toBeLessThanOrEqual(30);
  });
});
