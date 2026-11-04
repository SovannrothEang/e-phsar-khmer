import { validate } from './config.validation';

const requiredEnvironment = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  DATABASE_URL: 'postgres://user:password@localhost:5432/app',
  JWT_SECRET: '0123456789abcdef',
  JWT_REFRESH_SECRET: 'fedcba9876543210',
};

describe('outbox worker configuration', () => {
  it.each([
    ['OUTBOX_WORKER_CONCURRENCY', '0'],
    ['OUTBOX_WORKER_CONCURRENCY', '1.5'],
    ['OUTBOX_POLL_INTERVAL_MS', '0'],
    ['OUTBOX_BATCH_SIZE', '0'],
  ])('rejects invalid %s=%s values', (key, value) => {
    expect(() => validate({ ...requiredEnvironment, [key]: value })).toThrow(
      key,
    );
  });
});

describe('DEV_OTP_TOKEN', () => {
  it('is rejected in production — it would be an account-takeover bypass', () => {
    expect(() =>
      validate({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        DEV_OTP_TOKEN: '000000',
      }),
    ).toThrow('DEV_OTP_TOKEN');
  });

  it('is allowed outside production', () => {
    expect(
      validate({
        ...requiredEnvironment,
        NODE_ENV: 'development',
        DEV_OTP_TOKEN: '000000',
      }),
    ).toMatchObject({ DEV_OTP_TOKEN: '000000' });
  });
});

describe('OTP_PROVIDER=plasgate credentials', () => {
  const smsCredentials = {
    SMS_PRIVATE_KEY: 'private-key',
    SMS_SECRET: 'secret',
    SMS_SENDER: 'PSA',
  };

  it('defaults to plasgate', () => {
    expect(validate({ ...requiredEnvironment })).toMatchObject({
      OTP_PROVIDER: 'plasgate',
    });
  });

  it('rejects a production boot without SMS credentials — every code would silently fail', () => {
    expect(() =>
      validate({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        OTP_PROVIDER: 'plasgate',
      }),
    ).toThrow('OTP_PROVIDER');
  });

  it('names the missing credential', () => {
    expect(() =>
      validate({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        OTP_PROVIDER: 'plasgate',
        SMS_PRIVATE_KEY: 'private-key',
        SMS_SECRET: 'secret',
      }),
    ).toThrow('SMS_SENDER');
  });

  it('accepts a production boot with every SMS credential set', () => {
    expect(
      validate({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        OTP_PROVIDER: 'plasgate',
        ...smsCredentials,
      }),
    ).toMatchObject({ OTP_PROVIDER: 'plasgate', ...smsCredentials });
  });

  it('does not require SMS credentials when the provider is supabase', () => {
    expect(
      validate({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        OTP_PROVIDER: 'supabase',
      }),
    ).toMatchObject({ OTP_PROVIDER: 'supabase' });
  });

  it('warns but boots outside production when the sender is unconfigured', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(validate({ ...requiredEnvironment })).toMatchObject({
        OTP_PROVIDER: 'plasgate',
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('OTP_PROVIDER=plasgate'),
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe('PAYMENT_RECONCILE_PROVIDERS', () => {
  it('includes ABA by default, so a lost or late callback is recovered by the poller', () => {
    // Bakong has no webhook; ABA has one but it can be lost, so both are polled.
    expect(
      validate({ ...requiredEnvironment }).PAYMENT_RECONCILE_PROVIDERS,
    ).toBe('bakong,aba_payway');
  });
});

describe('INTERNAL_RECONCILE_SECRET', () => {
  it('treats an absent or blank value as disabled, not a validation error', () => {
    expect(
      validate({ ...requiredEnvironment }).INTERNAL_RECONCILE_SECRET,
    ).toBeUndefined();
    expect(
      validate({
        ...requiredEnvironment,
        INTERNAL_RECONCILE_SECRET: '',
      }).INTERNAL_RECONCILE_SECRET,
    ).toBeUndefined();
    expect(
      validate({
        ...requiredEnvironment,
        INTERNAL_RECONCILE_SECRET: '   ',
      }).INTERNAL_RECONCILE_SECRET,
    ).toBeUndefined();
  });

  it('rejects a value shorter than 16 characters', () => {
    expect(() =>
      validate({
        ...requiredEnvironment,
        INTERNAL_RECONCILE_SECRET: 'too-short',
      }),
    ).toThrow('INTERNAL_RECONCILE_SECRET');
  });

  it('accepts and trims a 16+ character value', () => {
    expect(
      validate({
        ...requiredEnvironment,
        INTERNAL_RECONCILE_SECRET: '  abcdefghijklmnop  ',
      }).INTERNAL_RECONCILE_SECRET,
    ).toBe('abcdefghijklmnop');
  });
});
