import { Effect, Layer } from 'effect';
import { DbClientTag } from '../../../../db/db.provider';
import { adminOverridePayment } from './admin-override-payment.use-case';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- jest.mock factories cannot close over imports */
jest.mock('effect', () =>
  require('../../../testing/effect-mock').createEffectMock(),
);
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

const mockUpsertPayment = jest.fn<unknown, unknown[]>();
const mockRecordHistory = jest.fn<unknown, unknown[]>();
const mockPostLedger = jest.fn<unknown, unknown[]>();
const mockEnqueueSettled = jest.fn<unknown, unknown[]>();

jest.mock('../transaction/upsert-payment.use-case', () => ({
  upsertPayment: (input: unknown) => mockUpsertPayment(input),
}));
jest.mock('../transaction/record-payment-status-history.use-case', () => ({
  recordPaymentStatusHistory: (input: unknown) => mockRecordHistory(input),
}));
jest.mock('../../ledgers', () => ({
  postPaymentSettlementLedger: (transaction: unknown, at: unknown) =>
    mockPostLedger(transaction, at),
}));
jest.mock('./enqueue-payment-settled-event.use-case', () => ({
  enqueuePaymentSettledEvent: (...args: unknown[]) =>
    mockEnqueueSettled(...args),
}));

const ROW = {
  id: 'pay-1',
  reference: 'REF-1',
  amount: '10.00',
  currency: 'USD',
  status: 'pending',
  version: 3,
};

function makeDb(current: unknown) {
  const db: Record<string, unknown> = {
    transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(db)),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve(current ? [current] : [])),
      })),
    })),
  };
  return db;
}

async function run(db: unknown, input: Record<string, unknown>) {
  const outbox = { wakeupAfterCommit: jest.fn() };
  const result = await Effect.runPromise(
    Effect.provide(
      adminOverridePayment(
        outbox as never,
        {
          id: 'pay-1',
          expectedVersion: 3,
          status: 'succeeded',
          actorId: 'admin-1',
          ...input,
        } as never,
      ),
      Layer.succeed(DbClientTag, db as never),
    ),
  );
  return { result, outbox };
}

describe('adminOverridePayment', () => {
  beforeEach(() => {
    mockUpsertPayment
      .mockReset()
      .mockReturnValue(Effect.succeed({ ...ROW, status: 'succeeded' }));
    mockRecordHistory
      .mockReset()
      .mockReturnValue(Effect.succeed({ id: 'hist-1' }));
    mockPostLedger
      .mockReset()
      .mockReturnValue(Effect.succeed({ id: 'ledger-1' }));
    mockEnqueueSettled.mockReset().mockReturnValue(Effect.succeed(undefined));
  });

  it('writes an audit row naming the actor', async () => {
    await run(makeDb(ROW), { reason: 'bank statement shows the transfer' });

    expect(mockRecordHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentTransactionId: 'pay-1',
        fromStatus: 'pending',
        toStatus: 'succeeded',
        actorType: 'admin',
        actorId: 'admin-1',
        reason: 'bank statement shows the transfer',
      }),
    );
  });

  it('posts the settlement ledger and announces it when the override settles a payment', async () => {
    await run(makeDb(ROW), {});

    expect(mockPostLedger).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSettled).toHaveBeenCalledTimes(1);
  });

  it('re-posts the ledger idempotently for an already-settled payment, so a missing row heals', async () => {
    await run(makeDb({ ...ROW, status: 'succeeded' }), { status: 'succeeded' });

    expect(mockRecordHistory).toHaveBeenCalledTimes(1);
    // The ledger key is the transaction id, so the second post is a no-op that
    // returns the existing row — it must still be attempted.
    expect(mockPostLedger).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSettled).toHaveBeenCalledTimes(1);
  });

  it('does not post a ledger row for a non-settling override', async () => {
    await run(makeDb(ROW), { status: 'failed' });

    expect(mockPostLedger).not.toHaveBeenCalled();
    expect(mockEnqueueSettled).not.toHaveBeenCalled();
  });

  it('rejects an unknown payment id instead of writing an audit row', async () => {
    await expect(run(makeDb(null), {})).rejects.toMatchObject({
      _tag: 'PaymentTransactionNotFoundError',
    });
    expect(mockRecordHistory).not.toHaveBeenCalled();
  });
});
