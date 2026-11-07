/**
 * CJS stand-in for the subset of `effect` these use-cases exercise.
 *
 * `effect` is ESM-only, so Jest cannot load it. Every payment use-case spec
 * mocks it at the module boundary; this is the shared implementation, used as
 * `jest.mock('effect', () => require('<path>').createEffectMock())`.
 *
 * Only what the generators actually use is implemented: succeed/fail values,
 * `gen`/`fn`, `tryPromise`/`promise`, service tags and `provide`, plus the
 * Exit shape `runInTransaction` checks.
 */
export function createEffectMock(): Record<string, unknown> {
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
        // Effect's YieldableError base makes `yield* new MyError()` legal;
        // without this, `yield*` throws "not iterable" before the interpreter
        // ever sees the failure.
        *[Symbol.iterator]() {
          return (yield this) as unknown;
        }
      },
  };

  return { Effect, Context, Layer, Exit, Schema };
}
