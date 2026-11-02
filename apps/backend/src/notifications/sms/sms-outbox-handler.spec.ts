import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { SmsOutboxHandler } from './sms-outbox-handler';

function event(
  payload: Record<string, unknown>,
  overrides: Partial<OutboxEventRow> = {},
): OutboxEventRow {
  return { id: 'evt-1', payload, attempts: 1, ...overrides } as OutboxEventRow;
}

function makeDb(userRow: Record<string, unknown> | undefined) {
  const updateSets: Record<string, unknown>[] = [];
  const db = {
    select: jest.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(userRow ? [userRow] : []),
        }),
      }),
    }),
    update: jest.fn().mockImplementation(() => ({
      set: (values: Record<string, unknown>) => {
        updateSets.push(values);
        return { where: () => Promise.resolve([]) };
      },
    })),
  };
  return { db, updateSets };
}

function makePlasGate(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    isConfigured: jest.fn().mockReturnValue(true),
    toInternational: jest.fn().mockReturnValue('85512345678'),
    send: jest.fn().mockResolvedValue({ outcome: 'sent', providerStatus: 200 }),
    ...overrides,
  };
}

function makeLimiter(decision: 'allowed' | 'over_budget' | 'unavailable') {
  return { tryAcquire: jest.fn().mockResolvedValue(decision) };
}

function makeUserLimiter(
  decision: 'allowed' | 'cooldown' | 'daily_cap' | 'unavailable' = 'allowed',
) {
  return {
    acquire: jest.fn().mockResolvedValue(decision),
    release: jest.fn().mockResolvedValue(undefined),
  };
}

describe('SmsOutboxHandler', () => {
  const verifiedUser = {
    primaryPhone: '+85512345678',
    phoneVerifiedAt: new Date(),
  };

  describe('per-user limits', () => {
    const payload = (notificationType: string) =>
      event({ userId: 'u1', notificationType, content: 'hi' });
    const build = (
      userLimiter: ReturnType<typeof makeUserLimiter>,
      limiter = makeLimiter('allowed'),
      plasGate = makePlasGate(),
      user: Record<string, unknown> = verifiedUser,
    ) => {
      const { db, updateSets } = makeDb(user);
      const handler = new SmsOutboxHandler(
        db as never,
        plasGate as never,
        limiter as never,
        userLimiter as never,
        { register: jest.fn() } as never,
      );
      return { handler, updateSets, plasGate };
    };

    it('skips a type outside the allowed list with type_not_allowed, without touching any limiter', async () => {
      const userLimiter = makeUserLimiter();
      const limiter = makeLimiter('allowed');
      const { handler, updateSets, plasGate } = build(userLimiter, limiter);

      const result = await handler.handle(payload('payment.succeeded'));

      expect(result).toEqual({ status: 'published' });
      expect(updateSets).toContainEqual(
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'type_not_allowed',
        }),
      );
      expect(userLimiter.acquire).not.toHaveBeenCalled();
      expect(limiter.tryAcquire).not.toHaveBeenCalled();
      expect(plasGate.send).not.toHaveBeenCalled();
    });

    it.each(['auth.phone.verify', 'auth.password.reset'])(
      'sends an allowed type (%s)',
      async (type) => {
        const { handler, plasGate } = build(makeUserLimiter());
        expect(await handler.handle(payload(type))).toEqual({
          status: 'published',
        });
        expect(plasGate.send).toHaveBeenCalledTimes(1);
      },
    );

    it('skips with rate_limited (dropped, not retried) inside the cooldown', async () => {
      const limiter = makeLimiter('allowed');
      const { handler, updateSets, plasGate } = build(
        makeUserLimiter('cooldown'),
        limiter,
      );

      const result = await handler.handle(payload('auth.phone.verify'));

      expect(result).toEqual({ status: 'published' });
      expect(updateSets).toContainEqual(
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'rate_limited',
        }),
      );
      expect(limiter.tryAcquire).not.toHaveBeenCalled();
      expect(plasGate.send).not.toHaveBeenCalled();
    });

    it('skips with daily_cap once the daily cap is reached', async () => {
      const { handler, updateSets, plasGate } = build(
        makeUserLimiter('daily_cap'),
      );

      const result = await handler.handle(payload('auth.password.reset'));

      expect(result).toEqual({ status: 'published' });
      expect(updateSets).toContainEqual(
        expect.objectContaining({ status: 'skipped', skipReason: 'daily_cap' }),
      );
      expect(plasGate.send).not.toHaveBeenCalled();
    });

    it('retries (fails closed) when the user limiter cannot reach Redis', async () => {
      const { handler, plasGate } = build(makeUserLimiter('unavailable'));
      const result = await handler.handle(payload('auth.phone.verify'));
      expect(result.status).toBe('retry');
      expect(plasGate.send).not.toHaveBeenCalled();
    });

    it('does not take a user slot for an unverified phone', async () => {
      const userLimiter = makeUserLimiter();
      const { handler } = build(
        userLimiter,
        makeLimiter('allowed'),
        makePlasGate(),
        { primaryPhone: '+85512345678', phoneVerifiedAt: null },
      );
      await handler.handle(payload('auth.phone.verify'));
      expect(userLimiter.acquire).not.toHaveBeenCalled();
    });

    it('does not take a user slot for an invalid number', async () => {
      const userLimiter = makeUserLimiter();
      const { handler } = build(
        userLimiter,
        makeLimiter('allowed'),
        makePlasGate({ toInternational: jest.fn().mockReturnValue(null) }),
      );
      await handler.handle(payload('auth.phone.verify'));
      expect(userLimiter.acquire).not.toHaveBeenCalled();
    });

    it('gives the user slot back when the global limiter is over budget (retry must not burn the cooldown)', async () => {
      const userLimiter = makeUserLimiter();
      const { handler, plasGate } = build(
        userLimiter,
        makeLimiter('over_budget'),
      );

      const result = await handler.handle(payload('auth.phone.verify'));

      expect(result.status).toBe('retry');
      expect(userLimiter.acquire).toHaveBeenCalledTimes(1);
      expect(userLimiter.release).toHaveBeenCalledWith({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        eventId: 'evt-1',
      });
      expect(plasGate.send).not.toHaveBeenCalled();
    });

    it('gives the user slot back when PlasGate asks for a retry, but keeps it after a successful send', async () => {
      const retryUserLimiter = makeUserLimiter();
      const retrying = build(
        retryUserLimiter,
        makeLimiter('allowed'),
        makePlasGate({
          send: jest
            .fn()
            .mockResolvedValue({ outcome: 'retry', providerReply: 'timeout' }),
        }),
      );
      await retrying.handler.handle(payload('auth.phone.verify'));
      expect(retryUserLimiter.release).toHaveBeenCalledTimes(1);

      const sentUserLimiter = makeUserLimiter();
      await build(sentUserLimiter).handler.handle(payload('auth.phone.verify'));
      expect(sentUserLimiter.release).not.toHaveBeenCalled();
    });
  });

  it('registers itself on module init', () => {
    const register = jest.fn();
    const { db } = makeDb(verifiedUser);
    const handler = new SmsOutboxHandler(
      db as never,
      makePlasGate() as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register } as never,
    );

    handler.onModuleInit();
    expect(register).toHaveBeenCalledWith(handler);
  });

  it('skips with not_configured and still reports published when PlasGate has no credentials', async () => {
    const { db, updateSets } = makeDb(verifiedUser);
    const plasGate = makePlasGate({
      isConfigured: jest.fn().mockReturnValue(false),
    });
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );

    expect(result).toEqual({ status: 'published' });
    expect(plasGate.send).not.toHaveBeenCalled();
    expect(updateSets).toContainEqual(
      expect.objectContaining({
        status: 'skipped',
        skipReason: 'not_configured',
      }),
    );
  });

  it('skips with phone_not_verified and reports published for an unverified phone', async () => {
    const { db, updateSets } = makeDb({
      primaryPhone: '+85512345678',
      phoneVerifiedAt: null,
    });
    const plasGate = makePlasGate();
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );

    expect(result).toEqual({ status: 'published' });
    expect(plasGate.send).not.toHaveBeenCalled();
    expect(updateSets).toContainEqual(
      expect.objectContaining({
        status: 'skipped',
        skipReason: 'phone_not_verified',
        attempts: 1,
      }),
    );
  });

  it('skips when the user has no phone at all', async () => {
    const { db } = makeDb({ primaryPhone: null, phoneVerifiedAt: null });
    const plasGate = makePlasGate();
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );
    expect(result).toEqual({ status: 'published' });
    expect(plasGate.send).not.toHaveBeenCalled();
  });

  it('retries when the rate limiter reports over_budget, without calling PlasGate', async () => {
    const { db } = makeDb(verifiedUser);
    const plasGate = makePlasGate();
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('over_budget') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );
    expect(result.status).toBe('retry');
    expect(plasGate.send).not.toHaveBeenCalled();
  });

  it('retries (fails closed) when the rate limiter is unavailable', async () => {
    const { db } = makeDb(verifiedUser);
    const plasGate = makePlasGate();
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('unavailable') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );
    expect(result.status).toBe('retry');
    expect(plasGate.send).not.toHaveBeenCalled();
  });

  it('publishes and marks sent on a 2xx PlasGate response', async () => {
    const { db, updateSets } = makeDb(verifiedUser);
    const plasGate = makePlasGate();
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );
    expect(result).toEqual({ status: 'published' });
    expect(updateSets).toContainEqual(
      expect.objectContaining({
        status: 'sent',
        providerStatus: 200,
        attempts: 1,
      }),
    );
  });

  it('retries on a PlasGate network/timeout error', async () => {
    const { db, updateSets } = makeDb(verifiedUser);
    const plasGate = makePlasGate({
      send: jest
        .fn()
        .mockResolvedValue({ outcome: 'retry', providerReply: 'timeout' }),
    });
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );
    expect(result.status).toBe('retry');
    expect(updateSets).toContainEqual(expect.objectContaining({ attempts: 1 }));
  });

  it('fails permanently on a 400 Invalid Sender', async () => {
    const { db, updateSets } = makeDb(verifiedUser);
    const plasGate = makePlasGate({
      send: jest.fn().mockResolvedValue({
        outcome: 'failed',
        providerStatus: 400,
        providerReply: 'Invalid Sender',
      }),
    });
    const handler = new SmsOutboxHandler(
      db as never,
      plasGate as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
    );
    expect(result.status).toBe('failed');
    expect(updateSets).toContainEqual(
      expect.objectContaining({
        status: 'failed',
        providerStatus: 400,
        attempts: 1,
      }),
    );
  });

  it('marks the row failed when the outbox abandons the event', async () => {
    const { db, updateSets } = makeDb(verifiedUser);
    const handler = new SmsOutboxHandler(
      db as never,
      makePlasGate() as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    await handler.onAbandoned(
      event({
        userId: 'u1',
        notificationType: 'auth.phone.verify',
        content: 'hi',
      }),
      'budget exhausted',
    );

    expect(updateSets).toContainEqual(
      expect.objectContaining({ status: 'failed', attempts: 1 }),
    );
  });

  it('records the outbox attempt number on a limiter-retry exit (audit row must not read 0)', async () => {
    const { db, updateSets } = makeDb(verifiedUser);
    const handler = new SmsOutboxHandler(
      db as never,
      makePlasGate() as never,
      makeLimiter('allowed') as never,
      makeUserLimiter('unavailable') as never,
      { register: jest.fn() } as never,
    );

    const result = await handler.handle(
      event(
        {
          userId: 'u1',
          notificationType: 'auth.phone.verify',
          content: 'hi',
        },
        { attempts: 7 },
      ),
    );

    expect(result.status).toBe('retry');
    expect(updateSets).toContainEqual(expect.objectContaining({ attempts: 7 }));
  });

  it('redact strips the message content from the stored payload', () => {
    const { db } = makeDb(verifiedUser);
    const handler = new SmsOutboxHandler(
      db as never,
      makePlasGate() as never,
      makeLimiter('allowed') as never,
      makeUserLimiter() as never,
      { register: jest.fn() } as never,
    );

    const redacted = handler.redact({
      userId: 'u1',
      notificationType: 'auth.phone.verify',
      content: 'your OTP is 123456',
    }) as Record<string, unknown>;

    expect(JSON.stringify(redacted)).not.toContain('123456');
    expect(redacted.userId).toBe('u1');
  });
});
