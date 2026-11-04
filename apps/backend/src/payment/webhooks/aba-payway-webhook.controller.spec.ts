import { createHmac } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AbaPaywayWebhookController } from './aba-payway-webhook.controller';
import { AbaPaywayProvider } from '../providers/aba-payway/aba-payway.provider';
import { PaymentEffectRunner } from '../payment-effect-runner.service';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { SKIP_ENVELOPE_KEY } from '../../common/decorators/skip-envelope.decorator';

/**
 * Real provider + real controller, fully offline: same mocks as
 * `aba-payway.provider.spec.ts` for the network, and mocked use-cases behind a
 * fake effect runner for the DB. Key assertion: a bad callback writes nothing.
 */
const mockNetworkPost = jest.fn((): never => {
  throw new Error('a network call was attempted from a unit test');
});
const mockFindAttempt = jest.fn((input: unknown) => ({ op: 'find', input }));
const mockReceive = jest.fn((outbox: unknown, input: unknown) => ({
  op: 'receive',
  outbox,
  input,
}));

jest.mock('../../utils/api-client', () => ({
  createApiClient: jest.fn(() => ({
    post: (...args: unknown[]) =>
      (mockNetworkPost as (...a: unknown[]) => never)(...args),
  })),
}));
// `@nestjs/throttler` is ESM-only under Jest; the decorator's own behaviour is
// covered by Nest, the controller only needs it applied.
jest.mock('@nestjs/throttler', () => ({
  SkipThrottle: () => () => undefined,
}));
jest.mock('effect', () => ({ Effect: { runPromise: jest.fn() } }));
jest.mock(
  '../providers/aba-payway/handlers/create-transaction.handler',
  () => ({ createAbaPaywayTransaction: jest.fn() }),
);
jest.mock('../providers/aba-payway/handlers/check-transaction.handler', () => ({
  checkAbaPaywayTransaction: jest.fn(),
}));
jest.mock('../payment-effect-runner.service', () => ({
  PaymentEffectRunner: class {},
}));
jest.mock('../use-cases', () => ({
  findPaymentAttemptByProviderAttemptId: (input: unknown) =>
    mockFindAttempt(input),
  receivePaymentProviderEvent: (outbox: unknown, input: unknown) =>
    mockReceive(outbox, input),
}));

const API_KEY = 'unit-test-api-key-0123456789';
const SIG = 'x-payway-hmac-sha512';
const FAKE_OUTBOX = { fake: 'outbox' };

function abaSignature(payload: Record<string, unknown>, key = API_KEY) {
  const data = Object.keys(payload)
    .sort()
    .map((k) => {
      const v = payload[k];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v as string | number | boolean);
    })
    .join('');
  return createHmac('sha512', key).update(data, 'utf-8').digest('base64');
}

const callback: Record<string, unknown> = {
  tran_id: 'Ab-_9x7Qk2LmN4pRsT8v',
  apv: '832865',
  status: '0',
  return_params: '',
  original_amount: 10.5,
  original_currency: 'USD',
  payment_amount: 10.5,
  payment_currency: 'USD',
  total_amount: 10.5,
  discount_amount: 0,
  transaction_date: '2026-10-15 10:11:12',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  bank_ref: 'FT123456',
  payment_type: 'KHQR',
  payer_account: '',
  bank_name: 'ABA Bank',
  card_source: '',
};

/** `null` = no attempt matches the callback's tran_id. */
function build(foundAttempt: { id: string } | null = { id: 'attempt-1' }) {
  const provider = new AbaPaywayProvider({
    get: (key: string) =>
      ({
        'abaPayway.apiKey': API_KEY,
        'abaPayway.merchantId': 'merchant-1',
        'abaPayway.webhookUrl': 'https://backend.invalid/hook',
        'abaPayway.baseUrl': 'https://aba.invalid',
      })[key],
  } as never);
  const effectRunner = {
    run: jest.fn((effect: { op: string }) =>
      Promise.resolve(
        effect.op === 'find' ? (foundAttempt ?? undefined) : undefined,
      ),
    ),
    runDurably: jest.fn((fn: (outbox: unknown) => unknown) =>
      Promise.resolve(fn(FAKE_OUTBOX)),
    ),
  };
  const controller = new AbaPaywayWebhookController(
    effectRunner as never,
    provider,
  );
  return { controller, effectRunner };
}

afterEach(() => {
  expect(mockNetworkPost).not.toHaveBeenCalled();
  jest.clearAllMocks();
});

describe('AbaPaywayWebhookController ack contract', () => {
  it('opts the whole controller out of the response envelope', () => {
    // The global ResponseInterceptor reads this key; without it the ack would
    // reach ABA as `{ success: true, data: { code: 0 } }` and look like a
    // failure.
    expect(
      Reflect.getMetadata(SKIP_ENVELOPE_KEY, AbaPaywayWebhookController),
    ).toBe(true);
  });
});

describe('AbaPaywayWebhookController.webhook', () => {
  it('stores a correctly signed callback and acks with a top-level code 0', async () => {
    const { controller, effectRunner } = build();

    const ack = await controller.webhook(callback, {
      [SIG]: abaSignature(callback),
    });

    // Exactly ABA's contract — no `message`, no envelope (see spec.md).
    expect(ack).toEqual({ code: 0 });
    expect(mockFindAttempt).toHaveBeenCalledWith({
      provider: 'aba_payway',
      providerAttemptId: callback.tran_id,
    });
    expect(effectRunner.runDurably).toHaveBeenCalledTimes(1);
    expect(mockReceive).toHaveBeenCalledWith(FAKE_OUTBOX, {
      provider: 'aba_payway',
      providerEventId: `${String(callback.tran_id)}:0`,
      eventType: 'payment.notify',
      payload: callback,
      paymentAttemptId: 'attempt-1',
    });
  });

  it('still stores (uncorrelated) a signed callback for a tran_id we have no attempt for', async () => {
    const { controller } = build(null);

    await controller.webhook(callback, { [SIG]: abaSignature(callback) });

    expect(mockReceive).toHaveBeenCalledWith(
      FAKE_OUTBOX,
      expect.objectContaining({ paymentAttemptId: undefined }),
    );
  });

  it('rejects a bad signature with 401 and writes nothing', async () => {
    const { controller, effectRunner } = build();

    await expect(
      controller.webhook(
        { ...callback, status: '0' },
        { [SIG]: abaSignature(callback, 'attacker-key') },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(effectRunner.run).not.toHaveBeenCalled();
    expect(effectRunner.runDurably).not.toHaveBeenCalled();
    expect(mockReceive).not.toHaveBeenCalled();
  });

  it('rejects a forged "approved" body replayed under a genuine rejection’s signature', async () => {
    const { controller, effectRunner } = build();
    const rejected = { ...callback, status: '2' };

    await expect(
      controller.webhook(callback, { [SIG]: abaSignature(rejected) }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(effectRunner.runDurably).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header with 401 and writes nothing', async () => {
    const { controller, effectRunner } = build();

    await expect(controller.webhook(callback, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(effectRunner.runDurably).not.toHaveBeenCalled();
  });

  it('rejects an empty body with 401, not a 500', async () => {
    const { controller, effectRunner } = build();

    await expect(
      controller.webhook({}, { [SIG]: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(effectRunner.runDurably).not.toHaveBeenCalled();
  });

  it('answers 400 (not 500) to a genuinely signed callback that has no tran_id, and writes nothing', async () => {
    const { controller, effectRunner } = build();
    const noTranId = { ...callback };
    delete noTranId.tran_id;

    await expect(
      controller.webhook(noTranId, { [SIG]: abaSignature(noTranId) }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(effectRunner.run).not.toHaveBeenCalled();
    expect(effectRunner.runDurably).not.toHaveBeenCalled();
  });

  it('records an ambiguous status as an event the processor will not treat as approval', async () => {
    const { controller } = build();
    const ambiguous = { ...callback, status: '' };

    await controller.webhook(ambiguous, { [SIG]: abaSignature(ambiguous) });

    // The stored row keeps ABA's payload verbatim; the provider maps this
    // status to `unknown` (covered in aba-payway.provider.spec.ts), which
    // processProviderEvent treats as pending — never succeeded.
    expect(mockReceive).toHaveBeenCalledWith(
      FAKE_OUTBOX,
      expect.objectContaining({
        providerEventId: `${String(callback.tran_id)}:`,
        payload: ambiguous,
      }),
    );
  });
});

describe('AbaPaywayWebhookController over HTTP', () => {
  it('answers exactly { code: 0 } with no response envelope', async () => {
    const effectRunner = {
      run: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
      runDurably: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      name: 'aba_payway',
      verifyWebhookSignature: jest.fn(() => ({ valid: true })),
      parseWebhookEvent: jest.fn(() => ({
        providerEventId: 'evt-1',
        eventType: 'payment.notify',
        providerAttemptId: 'attempt-1',
        status: 'succeeded',
      })),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AbaPaywayWebhookController],
      providers: [
        { provide: PaymentEffectRunner, useValue: effectRunner },
        { provide: AbaPaywayProvider, useValue: provider },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    // Exactly how main.ts wires it: the global interceptor must honour the
    // controller's `@SkipEnvelope()`.
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.init();

    try {
      const res = await request(app.getHttpServer() as App)
        .post('/payments/webhooks/aba-payway')
        .send({ tran_id: 'x', status: 0 })
        .expect(200);

      expect(res.body).toEqual({ code: 0 });
      expect(effectRunner.runDurably).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
