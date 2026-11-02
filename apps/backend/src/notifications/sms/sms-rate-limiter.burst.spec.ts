import { SmsRateLimiter } from './sms-rate-limiter';

function makeConfig(limit: number) {
  return {
    get: (key: string) =>
      key === 'sms.rateLimitPerMinute' ? limit : undefined,
  } as unknown as import('@nestjs/config').ConfigService;
}

/** Same in-memory sliding-window mirror used by `sms-rate-limiter.spec.ts`. */
class FakeRedis {
  private readonly entries: number[] = [];

  // `eval` here is ioredis's `Redis#eval()` client method name (a Redis
  // `EVAL` RPC), not JavaScript's `eval()` — no string is interpreted as
  // code; see the identical note in `sms-rate-limiter.spec.ts`.
  eval(
    _script: string,
    _numKeys: number,
    _key: string,
    now: string,
    windowMs: string,
    limit: string,
  ): Promise<number> {
    const nowNum = Number(now);
    const cutoff = nowNum - Number(windowMs);
    const limitNum = Number(limit);
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i] <= cutoff) this.entries.splice(i, 1);
    }
    if (this.entries.length < limitNum) {
      this.entries.push(nowNum);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}

/**
 * Exercises `SmsRateLimiter` under a burst the way `SmsOutboxHandler` would
 * drive it: poll `tryAcquire()`, and on `over_budget` wait a short beat
 * before trying again — a stand-in for the outbox's own retry-with-backoff
 * loop (see `sms-outbox-events.ts` for why `SMS_REQUESTED_MAX_ATTEMPTS` is
 * raised well past the global default to give this room). This test is
 * scoped to the limiter + a stubbed PlasGate send, not the real
 * `OutboxDispatcher` scheduling.
 */
describe('SmsRateLimiter burst', () => {
  it('delivers 300 queued messages, none abandoned, with no 60s window over 200 calls', async () => {
    jest.useFakeTimers();
    const redis = new FakeRedis();
    const limiter = new SmsRateLimiter(redis as never, makeConfig(150));

    const callTimestamps: number[] = [];
    const stubbedSend = () => {
      callTimestamps.push(Date.now());
      return Promise.resolve({ outcome: 'sent' as const });
    };

    const TOTAL = 300;
    const RETRY_DELAY_MS = 250;
    let delivered = 0;
    let abandoned = 0;
    const MAX_RETRIES_PER_MESSAGE = 50;

    async function deliverOne(): Promise<void> {
      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MESSAGE; attempt++) {
        const decision = await limiter.tryAcquire();
        if (decision === 'allowed') {
          await stubbedSend();
          delivered++;
          return;
        }
        // over_budget (or transiently unavailable): wait a beat and retry,
        // same shape as the outbox's retry-with-backoff.
        jest.advanceTimersByTime(RETRY_DELAY_MS);
      }
      abandoned++;
    }

    const jobs: Promise<void>[] = [];
    for (let i = 0; i < TOTAL; i++) {
      jobs.push(deliverOne());
    }
    await Promise.all(jobs);

    expect(abandoned).toBe(0);
    expect(delivered).toBe(TOTAL);

    // No rolling 60-second window saw more than 200 calls (PlasGate's own
    // ceiling), even though the shared budget enforced here is 150.
    const sorted = [...callTimestamps].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = sorted[i] + 60_000;
      let count = 0;
      for (let j = i; j < sorted.length && sorted[j] < windowEnd; j++) {
        count++;
      }
      expect(count).toBeLessThanOrEqual(200);
    }

    jest.useRealTimers();
  });
});
