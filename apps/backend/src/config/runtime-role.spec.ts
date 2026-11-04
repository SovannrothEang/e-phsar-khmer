import {
  backgroundProviders,
  resolveAppRole,
  runsBackgroundWork,
} from './runtime-role';

describe('resolveAppRole', () => {
  it.each([
    ['api', 'api'],
    ['worker', 'worker'],
    ['all', 'all'],
    [undefined, 'all'],
    ['', 'all'],
    ['cron', 'all'],
    ['API', 'all'],
  ])('maps %s to %s', (raw, expected) => {
    expect(resolveAppRole(raw)).toBe(expected);
  });
});

describe('runsBackgroundWork', () => {
  it('is false only for the api role', () => {
    expect(runsBackgroundWork('api')).toBe(false);
    expect(runsBackgroundWork('worker')).toBe(true);
    expect(runsBackgroundWork('all')).toBe(true);
  });
});

describe('backgroundProviders', () => {
  it('drops every provider in the api role', () => {
    expect(backgroundProviders(['a', 'b'], 'api')).toEqual([]);
  });

  it('keeps the providers in the worker and all roles', () => {
    expect(backgroundProviders(['a', 'b'], 'worker')).toEqual(['a', 'b']);
    expect(backgroundProviders(['a', 'b'], 'all')).toEqual(['a', 'b']);
  });

  it('returns a copy, so a caller cannot mutate the module provider list', () => {
    const source = ['a'];
    backgroundProviders(source, 'all').push('b');
    expect(source).toEqual(['a']);
  });
});

/**
 * `module: nodenext` resolves a literal `import('./x')` under ESM rules, which
 * would demand a `.js` extension this CJS codebase does not use. Taking the
 * path as a variable keeps the resolution at runtime (Jest's CJS loader).
 */
async function loadModule(path: string): Promise<Record<string, unknown>> {
  return (await import(path)) as Record<string, unknown>;
}

/**
 * The helper above is only useful if the modules actually use it. These cases
 * read the `providers` metadata Nest stored at decoration time, which is the
 * same list the DI container will instantiate.
 */
describe('APP_ROLE=api module wiring', () => {
  const original = process.env.APP_ROLE;

  beforeEach(() => {
    jest.resetModules();
    process.env.APP_ROLE = 'api';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.APP_ROLE;
    else process.env.APP_ROLE = original;
    jest.resetModules();
  });

  it.each([
    [
      'listings',
      '../listings/listings.module',
      'ListingsModule',
      '../listings/listing-expiry.processor',
      'ListingExpiryProcessor',
    ],
    [
      'chat',
      '../chat/chat.module',
      'ChatModule',
      '../chat/chat-maintenance.processor',
      'ChatMaintenanceProcessor',
    ],
    [
      'resume',
      '../resume/resume.module',
      'ResumeModule',
      '../resume/resume-maintenance.processor',
      'ResumeMaintenanceProcessor',
    ],
    [
      'subscriptions',
      '../subscriptions/subscriptions-core.module',
      'SubscriptionsCoreModule',
      '../subscriptions/entitlements-sweep.processor',
      'EntitlementsProcessor',
    ],
    // `payment/payment.module` is wired the same way, but importing it pulls
    // `payment-effect-runner.service.ts` → the ESM-only `effect` package,
    // which Jest cannot transform here. The payment line is covered by the
    // build and the independent review instead.
  ])(
    'does not register the %s processor',
    async (_name, modPath, moduleName, procPath, procName) => {
      const mod = await loadModule(modPath);
      const proc = await loadModule(procPath);
      const providers =
        (Reflect.getMetadata('providers', mod[moduleName] as object) as
          | unknown[]
          | undefined) ?? [];

      expect(providers.length).toBeGreaterThan(0);
      expect(providers).not.toContain(proc[procName]);
    },
  );
});

describe('APP_ROLE=all module wiring', () => {
  const original = process.env.APP_ROLE;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.APP_ROLE;
  });

  afterEach(() => {
    if (original !== undefined) process.env.APP_ROLE = original;
    jest.resetModules();
  });

  it('keeps the listings processor, so the default shape still drains jobs', async () => {
    const mod = await loadModule('../listings/listings.module');
    const proc = await loadModule('../listings/listing-expiry.processor');
    const providers =
      (Reflect.getMetadata('providers', mod.ListingsModule as object) as
        | unknown[]
        | undefined) ?? [];

    expect(providers).toContain(proc.ListingExpiryProcessor);
  });
});
