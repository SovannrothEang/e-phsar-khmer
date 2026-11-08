import configuration from './configuration';

const requiredEnvironment: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  DATABASE_URL: 'postgres://user:password@localhost:5432/app',
  JWT_SECRET: '0123456789abcdef',
  JWT_REFRESH_SECRET: 'fedcba9876543210',
  // Keeps validate() quiet: the default plasgate path warns outside production
  // when the SMS sender is unconfigured.
  OTP_PROVIDER: 'supabase',
};

/** Runs `configuration()` against a controlled environment, then restores it. */
function withEnvironment<T>(
  extra: Record<string, string | undefined>,
  run: () => T,
): T {
  const saved = new Map<string, string | undefined>();
  for (const key of [
    ...Object.keys(requiredEnvironment),
    ...Object.keys(extra),
  ]) {
    saved.set(key, process.env[key]);
  }
  Object.assign(process.env, requiredEnvironment);
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('role-aware database pool', () => {
  it.each([
    ['api', 5],
    ['worker', 15],
    ['all', 20],
  ])('defaults APP_ROLE=%s to a pool of %i', (role, expected) => {
    const config = withEnvironment({ APP_ROLE: role }, () => configuration());
    expect(config.database.poolMax).toBe(expected);
  });

  it('keeps an explicit override, because a bigger worker pool is a real choice', () => {
    const config = withEnvironment(
      { APP_ROLE: 'api', DATABASE_POOL_MAX: '3' },
      () => configuration(),
    );
    expect(config.database.poolMax).toBe(3);
  });

  it('defaults to the all shape when APP_ROLE is unset', () => {
    const config = withEnvironment({ APP_ROLE: undefined }, () =>
      configuration(),
    );
    expect(config.appRole).toBe('all');
    expect(config.database.poolMax).toBe(20);
  });
});

describe('role-aware background work', () => {
  it('turns every in-process loop off in the api role', () => {
    const config = withEnvironment(
      {
        APP_ROLE: 'api',
        OUTBOX_WORKER_ENABLED: 'true',
        ACCOUNT_PURGE_ENABLED: 'true',
        PAYMENT_RECONCILER_ENABLED: 'true',
      },
      () => configuration(),
    );

    expect(config.outbox.workerEnabled).toBe(false);
    expect(config.accounts.purgeEnabled).toBe(false);
    expect(config.payment.reconcilerEnabled).toBe(false);
  });

  it('keeps them on in the worker and all shapes', () => {
    for (const role of ['worker', 'all']) {
      const config = withEnvironment({ APP_ROLE: role }, () => configuration());
      expect(config.outbox.workerEnabled).toBe(true);
      expect(config.accounts.purgeEnabled).toBe(true);
      expect(config.payment.reconcilerEnabled).toBe(true);
    }
  });

  it('still honours an explicit false inside a worker shape', () => {
    const config = withEnvironment(
      { APP_ROLE: 'worker', OUTBOX_WORKER_ENABLED: 'false' },
      () => configuration(),
    );
    expect(config.outbox.workerEnabled).toBe(false);
  });
});

describe('connection timeouts', () => {
  it('defaults statement and lock timeouts to off (the pooler rejects them)', () => {
    const config = withEnvironment({}, () => configuration());
    expect(config.database.statementTimeoutMs).toBe(0);
    expect(config.database.lockTimeoutMs).toBe(0);
  });

  it('passes an explicit statement timeout through', () => {
    const config = withEnvironment(
      { DATABASE_STATEMENT_TIMEOUT_MS: '30000' },
      () => configuration(),
    );
    expect(config.database.statementTimeoutMs).toBe(30_000);
  });
});
