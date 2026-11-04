import { Effect, Layer } from 'effect';
import { DbClientTag } from '../../../../db/db.provider';
import { PaymentGatewayRegistryTag } from '../../../providers/payment-gateway-registry.provider';
import { processProviderEvent } from './process-provider-event.use-case';

/**
 * `effect` is ESM-only, so Jest cannot load it — the same constraint every
 * other payment spec works around (see `payment-reconciler.service.spec.ts`,
 * which mocks the Promise boundary instead). `processProviderEvent` is written
 * entirely in generators, so this is a deliberately small CJS stand-in for the
 * subset it and `db.provider` use: succeed/fail values, `gen`/`fn`,
 * `tryPromise`/`promise`, service tags and `provide`, plus the Exit shape
 * `runInTransaction` checks. Only what this spec exercises is implemented.
 */
jest.mock('effect', () => {
  const SERVICE_KEY = '__serviceKey';

  interface MockEffect {
    _tag: string;
    [key: string]: unknown;
  }
  type MockExit =
    | { _tag: 'Success'; value: unknown }
    | { _tag: 'Failure'; cause: unknown };

  /**
   * Every mock effect is `yield*`-able: delegation yields the effect object
   * itself to the interpreter and evaluates to the value the interpreter sends
   * back, which is exactly what `yield*` does with a real Effect.
   */
  const make = (
    tag: string,
    fields: Record<string, unknown> = {},
  ): MockEffect => ({
    _tag: tag,
    ...fields,
    [Symbol.iterator]: function* () {
      return (yield this) as unknown;
    },
  });

  const succeed = (value: unknown): MockEffect => make('Succeed', { value });
  const fail = (error: unknown): MockEffect => make('Fail', { error });

  const isEffect = (value: unknown): value is MockEffect =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { _tag?: unknown })._tag === 'string';

  async function runGenerator(
    gen: () => Generator<unknown, unknown, unknown>,
    context: Record<string, unknown>,
  ): Promise<MockEffect> {
    let iterator: Generator<unknown, unknown, unknown>;
    try {
      iterator = gen();
    } catch (error) {
      return fail(error);
    }

    let method: 'next' | 'throw' = 'next';
    let payload: unknown;
    for (;;) {
      let step: IteratorResult<unknown, unknown>;
      try {
        step =
          method === 'throw' ? iterator.throw(payload) : iterator.next(payload);
      } catch (error) {
        return fail(error);
      }
      if (step.done) return succeed(step.value);

      const yielded = step.value;
      // `yield* new SomeTypedError(...)` is how these use-cases fail.
      if (yielded instanceof Error) return fail(yielded);

      // `yield* DbClientTag` — a service lookup, not an effect.
      if (typeof yielded === 'function') {
        const key = (yielded as unknown as Record<string, unknown>)[
          SERVICE_KEY
        ];
        if (typeof key === 'string') {
          payload = context[key];
          method = 'next';
          continue;
        }
      }

      const result = await run(yielded, context);
      if (result._tag === 'Fail') {
        method = 'throw';
        payload = result.error;
      } else {
        method = 'next';
        payload = result.value;
      }
    }
  }

  async function run(
    effect: unknown,
    context: Record<string, unknown>,
  ): Promise<MockEffect> {
    if (!isEffect(effect)) return succeed(effect);

    switch (effect._tag) {
      case 'Succeed':
      case 'Fail':
        return effect;
      case 'Suspend': {
        const thunk = effect.thunk as () => Promise<MockEffect>;
        try {
          return await run(await thunk(), context);
        } catch (error) {
          return fail(error);
        }
      }
      case 'Provide': {
        const inner = effect.effect;
        const provided = effect.context as Record<string, unknown>;
        return run(inner, { ...context, ...provided });
      }
      case 'Gen':
        return runGenerator(
          effect.gen as () => Generator<unknown, unknown, unknown>,
          context,
        );
      default:
        return succeed(effect);
    }
  }

  const Effect = {
    succeed,
    fail,
    gen: (gen: () => Generator<unknown, unknown, unknown>) =>
      make('Gen', { gen }),
    fn:
      () =>
      (genFn: (...args: unknown[]) => Generator<unknown, unknown, unknown>) =>
      (...args: unknown[]) =>
        make('Gen', { gen: () => genFn(...args) }),
    tryPromise: (options: {
      try: () => Promise<unknown>;
      catch: (error: unknown) => unknown;
    }) =>
      make('Suspend', {
        thunk: async () => {
          try {
            return succeed(await options.try());
          } catch (error) {
            return fail(options.catch(error));
          }
        },
      }),
    promise: (thunk: () => Promise<unknown>) =>
      make('Suspend', {
        thunk: async () => {
          try {
            return succeed(await thunk());
          } catch (error) {
            return fail(error);
          }
        },
      }),
    provide: (effect: unknown, layer: { context: Record<string, unknown> }) =>
      make('Provide', { effect, context: layer.context }),
    failCause: (cause: unknown) => fail(cause),
    runPromise: async (effect: unknown) => {
      const result = await run(effect, {});
      if (result._tag === 'Fail') throw result.error;
      return result.value;
    },
    runPromiseExit: async (effect: unknown): Promise<MockExit> => {
      const result = await run(effect, {});
      return result._tag === 'Fail'
        ? { _tag: 'Failure', cause: result.error }
        : { _tag: 'Success', value: result.value };
    },
  };

  const Context = {
    Service: () => (key: string) => {
      const Service = class {
        // `yield* DbClientTag` is yieldable in Effect; here the class yields
        // itself and evaluates to the service the interpreter looks up.
        static *[Symbol.iterator]() {
          return (yield this) as unknown;
        }
      };
      Object.defineProperty(Service, SERVICE_KEY, { value: key });
      return Service;
    },
  };

  const Layer = {
    succeed: (tag: unknown, service: unknown) => ({
      context: {
        [(tag as Record<string, unknown>)[SERVICE_KEY] as string]: service,
      },
    }),
    mergeAll: (...layers: Array<{ context: Record<string, unknown> }>) => {
      const context: Record<string, unknown> = {};
      for (const layer of layers) Object.assign(context, layer.context);
      return { context };
    },
  };

  const Exit = {
    isSuccess: (exit: MockExit) => exit._tag === 'Success',
    isFailure: (exit: MockExit) => exit._tag === 'Failure',
    fail: (cause: unknown): MockExit => ({ _tag: 'Failure', cause }),
  };

  const Schema = {
    String: 'string',
    Number: 'number',
    Boolean: 'boolean',
    Defect: () => 'defect',
    TaggedError: () => (tag: string) =>
      class extends Error {
        readonly _tag: string;
        constructor(props?: Record<string, unknown>) {
          super(tag);
          this._tag = tag;
          Object.assign(this, props);
        }
      },
  };

  return { Effect, Context, Layer, Exit, Schema };
});

// The single-table primitives and the two outbox/ledger hand-offs are mocked:
// this spec tests processProviderEvent's branching, plus the real
// settleReconciledAttempt transaction orchestration on the late path.
const mockFindAttempt = jest.fn<unknown, unknown[]>();
const mockCheckPayment = jest.fn<unknown, unknown[]>();
const mockSettleProviderEvent = jest.fn<unknown, unknown[]>();
const mockUpdateAttempt = jest.fn<unknown, unknown[]>();
const mockUpsertDetail = jest.fn<unknown, unknown[]>();
const mockUpsertPayment = jest.fn<unknown, unknown[]>();
const mockRecordHistory = jest.fn<unknown, unknown[]>();
const mockPostLedger = jest.fn<unknown, unknown[]>();
const mockEnqueueSettled = jest.fn<unknown, unknown[]>();

jest.mock('../attempt/find-payment-attempt.use-case', () => ({
  findPaymentAttempt: (id: string) => mockFindAttempt(id),
}));
jest.mock('../transaction/check-payment.use-case', () => ({
  checkPayment: (id: string) => mockCheckPayment(id),
}));
jest.mock('../provider-event/settle-payment-provider-event.use-case', () => ({
  settlePaymentProviderEvent: (input: unknown) =>
    mockSettleProviderEvent(input),
}));
jest.mock('../attempt/update-payment-attempt.use-case', () => ({
  updatePaymentAttempt: (input: unknown) => mockUpdateAttempt(input),
}));
jest.mock('../transaction/upsert-payment-transaction-detail.use-case', () => ({
  upsertPaymentTransactionDetail: (input: unknown) => mockUpsertDetail(input),
}));
jest.mock('../transaction/upsert-payment.use-case', () => ({
  upsertPayment: (input: unknown) => mockUpsertPayment(input),
}));
jest.mock('../transaction/record-payment-status-history.use-case', () => ({
  recordPaymentStatusHistory: (input: unknown) => mockRecordHistory(input),
}));
jest.mock('../../ledgers/post-payment-settlement-ledger.use-case', () => ({
  postPaymentSettlementLedger: (transaction: unknown, occurredAt: unknown) =>
    mockPostLedger(transaction, occurredAt),
}));
jest.mock('./enqueue-payment-settled-event.use-case', () => ({
  enqueuePaymentSettledEvent: (
    outbox: unknown,
    transaction: unknown,
    ledger: unknown,
  ) => mockEnqueueSettled(outbox, transaction, ledger),
}));

const EVENT_ID = 'event-1';
const ATTEMPT_ID = 'attempt-1';
const TRANSACTION_ID = 'transaction-1';

type ProviderOverrides = {
  name?: 'aba_payway' | 'bakong';
  trustsVerifiedWebhook?: boolean;
  status?: 'succeeded' | 'failed' | 'unknown';
  reconcile?: (reference: string) => Promise<{
    status: string;
    rawResponse: unknown;
  }>;
};

/** An ABA-like provider: HMAC-verified webhook, no poll in this path. */
function provider(overrides: ProviderOverrides = {}) {
  const status = overrides.status ?? 'succeeded';
  return {
    name: overrides.name ?? 'aba_payway',
    displayName: 'ABA PayWay',
    trustsVerifiedWebhook: overrides.trustsVerifiedWebhook ?? true,
    isConfigured: () => true,
    reconcile: overrides.reconcile,
    parseWebhookEvent: () => ({
      providerEventId: `${EVENT_ID}:${status}`,
      eventType: 'payment.notify',
      providerAttemptId: 'tran-1',
      status,
      payload: {},
    }),
    redact: (payload: unknown) => payload,
  };
}

function build(overrides: ProviderOverrides = {}) {
  const event = {
    id: EVENT_ID,
    status: 'received',
    provider: overrides.name ?? 'aba_payway',
    paymentAttemptId: ATTEMPT_ID,
    // The stored, signature-verified ABA payload (status '0' = paid).
    payload: { tran_id: 'tran-1', status: '0' },
  };
  const attempt = {
    id: ATTEMPT_ID,
    paymentTransactionId: TRANSACTION_ID,
    provider: overrides.name ?? 'aba_payway',
    providerAttemptId: 'tran-1',
    status: 'failed' as 'pending' | 'succeeded' | 'failed',
    failureCode: 'EXPIRED' as string | null,
  };
  const transaction = {
    id: TRANSACTION_ID,
    version: 1,
    type: 'payment',
    status: 'pending',
    currency: 'USD',
    amount: '10.50',
    reference: 'ref-1',
    orderId: null,
    customerId: 'customer-1',
    expiresAt: new Date(Date.now() - 60_000),
  };
  const ledger = { id: 'ledger-1', occurredAt: new Date() };

  const db = {
    select: jest.fn(() => ({
      from: () => ({ where: () => Promise.resolve([event]) }),
    })),
    // `runInTransaction` opens this; the transaction handle itself is only
    // handed to the (mocked) single-table writes, so an empty object is enough.
    transaction: jest.fn((work: (tx: unknown) => Promise<unknown>) =>
      work({ tx: true }),
    ),
  };
  const registry = {
    resolve: jest.fn((name: string) => {
      const resolved = provider(overrides);
      return name === resolved.name ? resolved : undefined;
    }),
  };
  const outbox = { enqueue: jest.fn(), wakeupAfterCommit: jest.fn() };

  mockFindAttempt.mockImplementation(() => Effect.succeed(attempt));
  mockCheckPayment.mockImplementation(() => Effect.succeed(transaction));
  mockSettleProviderEvent.mockImplementation(() => Effect.succeed({}));
  mockUpdateAttempt.mockImplementation(() => Effect.succeed({}));
  mockUpsertDetail.mockImplementation(() => Effect.succeed({}));
  mockUpsertPayment.mockImplementation(() => Effect.succeed({}));
  mockRecordHistory.mockImplementation(() => Effect.succeed({}));
  mockPostLedger.mockImplementation(() => Effect.succeed(ledger));
  mockEnqueueSettled.mockImplementation(() => Effect.succeed(undefined));

  const run = async (): Promise<string> => {
    return (await Effect.runPromise(
      Effect.provide(
        processProviderEvent(
          outbox as never,
          { paymentProviderEventId: EVENT_ID } as never,
        ),
        Layer.mergeAll(
          DbClientTag.layer(db as never),
          PaymentGatewayRegistryTag.layer(registry as never),
        ),
      ),
    )) as string;
  };

  return { attempt, run };
}

describe('processProviderEvent — a late payment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settles an attempt we failed EXPIRED when ABA’s verified callback says paid', async () => {
    const { attempt, run } = build();

    await expect(run()).resolves.toBe('succeeded');

    // The attempt is moved out of `failed`, its timeout failure cleared, and
    // the transaction settles exactly once through the reconciled path.
    expect(mockUpdateAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: attempt.id,
        status: 'succeeded',
        clearFailure: true,
      }),
    );
    expect(mockUpsertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: TRANSACTION_ID,
        expectedVersion: 1,
        status: 'succeeded',
      }),
    );
    expect(mockRecordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'late_payment' }),
    );
    expect(mockPostLedger).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSettled).toHaveBeenCalledTimes(1);
    expect(mockSettleProviderEvent).toHaveBeenCalledWith({
      id: EVENT_ID,
      status: 'processed',
    });
  });

  it('is a no-op when the same late delivery arrives again', async () => {
    const { attempt, run } = build();

    await expect(run()).resolves.toBe('succeeded');
    mockPostLedger.mockClear();
    mockEnqueueSettled.mockClear();
    mockUpsertPayment.mockClear();

    // The first delivery has settled the attempt; ABA retrying the callback is
    // a duplicate, not a second settlement.
    attempt.status = 'succeeded';
    attempt.failureCode = null;

    await expect(run()).resolves.toBe('ignored_already_settled');
    expect(mockUpsertPayment).not.toHaveBeenCalled();
    expect(mockPostLedger).not.toHaveBeenCalled();
    expect(mockEnqueueSettled).not.toHaveBeenCalled();
    expect(mockSettleProviderEvent).toHaveBeenLastCalledWith({
      id: EVENT_ID,
      status: 'ignored',
    });
  });

  it('keeps a failed attempt failed when the callback itself reports failure', async () => {
    const { attempt, run } = build({ status: 'failed' });

    await expect(run()).resolves.toBe('ignored_already_settled');

    expect(attempt.status).toBe('failed');
    expect(mockUpsertPayment).not.toHaveBeenCalled();
    expect(mockPostLedger).not.toHaveBeenCalled();
    expect(mockSettleProviderEvent).toHaveBeenCalledWith({
      id: EVENT_ID,
      status: 'ignored',
    });
  });

  it('does not resurrect a failed attempt from an unverified webhook of another provider', async () => {
    // No reconcile() and no signature trust: the webhook alone is not proof.
    const { run } = build({
      name: 'bakong',
      trustsVerifiedWebhook: false,
      reconcile: undefined,
    });

    await expect(run()).resolves.toBe('ignored_already_settled');
    expect(mockPostLedger).not.toHaveBeenCalled();
    expect(mockEnqueueSettled).not.toHaveBeenCalled();
  });

  it('believes the reconciled answer over the webhook’s own status', async () => {
    // The webhook claims failure, but check-transaction says the money landed.
    const { run } = build({
      name: 'bakong',
      trustsVerifiedWebhook: false,
      status: 'failed',
      reconcile: () =>
        Promise.resolve({ status: 'succeeded', rawResponse: { paid: true } }),
    });

    await expect(run()).resolves.toBe('succeeded');
    expect(mockUpsertPayment).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' }),
    );
    expect(mockRecordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'late_payment' }),
    );
    expect(mockPostLedger).toHaveBeenCalledTimes(1);
  });
});

describe('processProviderEvent — the normal path is unchanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settles a pending attempt through the provider-event transaction', async () => {
    const { attempt, run } = build();
    attempt.status = 'pending';

    await expect(run()).resolves.toBe('succeeded');

    expect(mockUpsertPayment).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' }),
    );
    expect(mockRecordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'payment_provider_event' }),
    );
    expect(mockPostLedger).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSettled).toHaveBeenCalledTimes(1);
    expect(mockSettleProviderEvent).toHaveBeenCalledWith({
      id: EVENT_ID,
      status: 'processed',
    });
  });
});
