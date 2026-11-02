import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DbClient } from '../db/drizzle.provider';
import type { PlasGateClient } from '../notifications/sms/plasgate-client';
import type { SmsRateLimiter } from '../notifications/sms/sms-rate-limiter';
import { SmsUserLimiter } from '../notifications/sms/sms-user-limiter';
import { OtpSmsSender } from './otp-sms-sender';
import type { OtpService } from './otp.service';

const PHONE = '012345678';
const CODE = '654321';

/** Same in-memory mirror of the limiter Lua scripts as sms-user-limiter.spec. */
class FakeRedis {
  readonly kv = new Map<string, string>();
  readonly counters = new Map<string, number>();
  fail = false;
  ttlSeconds = 271;

  ttl(): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    return Promise.resolve(this.ttlSeconds);
  }

  // `eval` is ioredis's `Redis#eval()` RPC, not JavaScript's `eval()`.
  eval(script: string, _n: number, ...args: string[]): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const [cdKey, dayKey] = args;
    if (script.includes('INCR')) {
      const [eventId, , cap] = args.slice(2);
      const holder = this.kv.get(cdKey);
      if (holder === eventId) return Promise.resolve(1);
      if (holder !== undefined) return Promise.resolve(2);
      const n = (this.counters.get(dayKey) ?? 0) + 1;
      if (n > Number(cap)) return Promise.resolve(3);
      this.counters.set(dayKey, n);
      this.kv.set(cdKey, eventId);
      return Promise.resolve(1);
    }
    const [eventId] = args.slice(2);
    if (this.kv.get(cdKey) === eventId) {
      this.kv.delete(cdKey);
      this.counters.set(
        dayKey,
        Math.max(0, (this.counters.get(dayKey) ?? 0) - 1),
      );
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}

function setup(
  opts: {
    send?: jest.Mock;
    cap?: number;
    global?: 'allowed' | 'over_budget' | 'unavailable';
    configured?: boolean;
    devBypass?: boolean;
  } = {},
) {
  const redis = new FakeRedis();
  const config = {
    get: (k: string) =>
      k === 'sms.userCooldownSeconds'
        ? 300
        : k === 'sms.userDailyCap'
          ? (opts.cap ?? 10)
          : undefined,
  } as unknown as ConfigService;
  const userLimiter = new SmsUserLimiter(redis as never, config);
  const inserted: Record<string, unknown>[] = [];
  const db = {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v);
        return Promise.resolve();
      },
    }),
  } as unknown as DbClient;
  const otp = {
    devBypassActive: opts.devBypass ?? false,
    issue: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ id: 'otp-1', code: CODE, expiresAt: new Date() }),
      ),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
  const send =
    opts.send ??
    jest.fn().mockResolvedValue({
      outcome: 'sent',
      providerStatus: 200,
      providerReply: '{"ok":true}',
    });
  const plasGate = {
    isConfigured: () => opts.configured ?? true,
    toInternational: (p: string) => `855${p.slice(1)}`,
    send,
  } as unknown as PlasGateClient;
  const rateLimiter = {
    tryAcquire: jest.fn().mockResolvedValue(opts.global ?? 'allowed'),
  } as unknown as SmsRateLimiter;
  const sender = new OtpSmsSender(
    db,
    otp as unknown as OtpService,
    plasGate,
    rateLimiter,
    userLimiter,
    config,
  );
  return { sender, redis, otp, send, inserted, rateLimiter };
}

describe('OtpSmsSender', () => {
  let logs: string[];
  beforeEach(() => {
    logs = [];
    for (const m of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, m)
        .mockImplementation((msg: unknown) => void logs.push(String(msg)));
    }
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the code and records a delivery row without code or full phone', async () => {
    const { sender, send, inserted } = setup();
    const res = await sender.issueAndSend(PHONE, 'register', '1.1.1.1');
    expect(res).toEqual({ status: 'sent', retryAfterSeconds: 300 });
    expect(send).toHaveBeenCalledTimes(1);
    const sent = (send.mock.calls as [{ to: string; content: string }][])[0][0];
    expect(sent.to).toBe('85512345678');
    expect(sent.content).toContain(CODE);
    expect(sent.content).toContain('5 minutes');

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      userId: null,
      purpose: 'register',
      status: 'sent',
      maskedPhone: '*******78',
    });
    const dump = JSON.stringify(inserted) + logs.join('\n');
    expect(dump).not.toContain(CODE);
    expect(dump).not.toContain(PHONE);
  });

  it('uses different wording for password_reset', () => {
    const { sender } = setup();
    expect(sender.buildMessage('password_reset', CODE)).toContain(
      'password reset',
    );
    expect(sender.buildMessage('login', CODE)).toContain('verification code');
  });

  it('cooldown: refuses a second SMS, sends nothing, issues no new code, returns retryAfterSeconds', async () => {
    const { sender, send, otp, redis, inserted } = setup();
    await sender.issueAndSend(PHONE, 'login');
    redis.ttlSeconds = 187;
    const res = await sender.issueAndSend(PHONE, 'login');
    expect(res).toEqual({ status: 'cooldown', retryAfterSeconds: 187 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(otp.issue).toHaveBeenCalledTimes(1);
    expect(inserted[1]).toMatchObject({
      status: 'skipped',
      skipReason: 'rate_limited',
      userId: null,
    });
  });

  it('cooldown is per purpose and per phone', async () => {
    const { sender } = setup();
    expect((await sender.issueAndSend(PHONE, 'login')).status).toBe('sent');
    expect((await sender.issueAndSend(PHONE, 'password_reset')).status).toBe(
      'sent',
    );
    expect((await sender.issueAndSend('098888888', 'login')).status).toBe(
      'sent',
    );
  });

  it('daily cap: refuses once the phone reached the cap', async () => {
    const { sender, send, redis } = setup({ cap: 2 });
    expect((await sender.issueAndSend(PHONE, 'register')).status).toBe('sent');
    redis.kv.clear(); // cooldown elapsed
    expect((await sender.issueAndSend(PHONE, 'register')).status).toBe('sent');
    redis.kv.clear();
    expect(await sender.issueAndSend(PHONE, 'register')).toEqual({
      status: 'daily_cap',
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('concurrent requests for one phone+purpose send exactly one SMS', async () => {
    const { sender, send } = setup();
    const results = await Promise.all([
      sender.issueAndSend(PHONE, 'login'),
      sender.issueAndSend(PHONE, 'login'),
      sender.issueAndSend(PHONE, 'login'),
    ]);
    expect(results.filter((r) => r.status === 'sent')).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('provider 400 (e.g. Invalid Sender): invalidates the code, frees the slot, records failed', async () => {
    const send = jest.fn().mockResolvedValue({
      outcome: 'failed',
      providerStatus: 400,
      providerReply: `Invalid Sender for ${CODE}`,
    });
    const { sender, otp, inserted } = setup({ send });
    expect(await sender.issueAndSend(PHONE, 'register')).toEqual({
      status: 'provider_rejected',
    });
    expect(otp.invalidate).toHaveBeenCalledWith('otp-1');
    expect(inserted[0]).toMatchObject({
      status: 'failed',
      providerStatus: 400,
    });
    expect(JSON.stringify(inserted)).not.toContain(CODE);
    // slot released: an immediate retry is not on cooldown
    send.mockResolvedValue({ outcome: 'sent', providerStatus: 200 });
    expect((await sender.issueAndSend(PHONE, 'register')).status).toBe('sent');
  });

  it('transient failure: retries once in-request, then succeeds', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ outcome: 'retry', providerReply: 'timeout' })
      .mockResolvedValueOnce({ outcome: 'sent', providerStatus: 200 });
    const { sender } = setup({ send });
    expect((await sender.issueAndSend(PHONE, 'login')).status).toBe('sent');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('two transient failures: unavailable, code invalidated, no third attempt', async () => {
    const send = jest
      .fn()
      .mockResolvedValue({ outcome: 'retry', providerStatus: 503 });
    const { sender, otp } = setup({ send });
    expect(await sender.issueAndSend(PHONE, 'login')).toEqual({
      status: 'unavailable',
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(otp.invalidate).toHaveBeenCalledWith('otp-1');
  });

  it('Redis down fails closed: nothing issued, nothing sent', async () => {
    const { sender, send, otp, redis } = setup();
    redis.fail = true;
    expect(await sender.issueAndSend(PHONE, 'login')).toEqual({
      status: 'unavailable',
    });
    expect(send).not.toHaveBeenCalled();
    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('global rate limiter over budget: unavailable, code invalidated, slot released', async () => {
    const { sender, send, otp } = setup({ global: 'over_budget' });
    expect((await sender.issueAndSend(PHONE, 'login')).status).toBe(
      'unavailable',
    );
    expect(send).not.toHaveBeenCalled();
    expect(otp.invalidate).toHaveBeenCalledWith('otp-1');
  });

  it('unconfigured PlasGate: unavailable, nothing dialled', async () => {
    const { sender, send } = setup({ configured: false });
    expect((await sender.issueAndSend(PHONE, 'login')).status).toBe(
      'unavailable',
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('dev bypass: reports sent without taking a slot or calling PlasGate', async () => {
    const { sender, send, inserted } = setup({ devBypass: true });
    expect((await sender.issueAndSend(PHONE, 'login')).status).toBe('sent');
    expect(send).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it('releases the limiter slot when issue() throws, so the phone is not locked out', async () => {
    const { sender, otp } = setup();
    otp.issue.mockRejectedValueOnce(new Error('db down'));
    await expect(sender.issueAndSend(PHONE, 'register')).rejects.toThrow(
      'db down',
    );
    // The slot is free again: a follow-up request is allowed, not cooled down.
    expect((await sender.issueAndSend(PHONE, 'register')).status).toBe('sent');
  });
});

describe('OtpSmsSender recovery variants', () => {
  afterEach(() => jest.restoreAllMocks());

  it('issueAndSendDetached answers before PlasGate does, then still delivers', async () => {
    let release: (v: unknown) => void = () => undefined;
    const send = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const { sender } = setup({ send });
    const { result, delivery } = await sender.issueAndSendDetached(
      PHONE,
      'password_reset',
      '1.1.1.1',
    );
    expect(result).toEqual({ status: 'sent', retryAfterSeconds: 300 });
    release({ outcome: 'sent', providerStatus: 200, providerReply: 'ok' });
    await delivery;
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      (send.mock.calls as [{ content: string }][])[0][0].content,
    ).toContain(CODE);
  });

  it('a failed detached delivery releases the slot and kills the code', async () => {
    const send = jest
      .fn()
      .mockResolvedValue({ outcome: 'failed', providerStatus: 400 });
    const { sender, otp, redis } = setup({ send });
    const { result, delivery } = await sender.issueAndSendDetached(
      PHONE,
      'password_reset',
    );
    expect(result.status).toBe('sent');
    await delivery;
    expect(otp.invalidate).toHaveBeenCalledWith('otp-1');
    expect(redis.kv.size).toBe(0);
  });

  it('reserveOnly takes the same slot but sends and stores nothing', async () => {
    const { sender, otp, send } = setup();
    expect(await sender.reserveOnly(PHONE, 'password_reset')).toEqual({
      status: 'sent',
      retryAfterSeconds: 300,
    });
    const again = await sender.reserveOnly(PHONE, 'password_reset');
    expect(again.status).toBe('cooldown');
    expect(send).not.toHaveBeenCalled();
    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('reserveOnly and issueAndSendDetached refuse a repeat identically', async () => {
    const a = setup();
    const b = setup();
    await a.sender.issueAndSendDetached(PHONE, 'password_reset');
    await b.sender.reserveOnly(PHONE, 'password_reset');
    const real = await a.sender.issueAndSendDetached(PHONE, 'password_reset');
    const phantom = await b.sender.reserveOnly(PHONE, 'password_reset');
    expect(real.result).toEqual(phantom);
  });
});
