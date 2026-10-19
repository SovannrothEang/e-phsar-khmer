import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

const REVIEWER = '11111111-1111-4111-8111-111111111111';
const REPORTER = '22222222-2222-4222-8222-222222222222';
const TARGET_USER = '33333333-3333-4333-8333-333333333333';
const REPORT = '44444444-4444-4444-8444-444444444444';
const LISTING = '55555555-5555-4555-8555-555555555555';

type MockDb = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  transaction: jest.Mock;
};

function makeDb(): MockDb {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };
}

/** `.select().from().where().limit()` — the report lookup. */
function limitChain(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

/** Awaitable at `.where()`, and still exposing `.returning()` / `.limit()`. */
function whereResult(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), {
    returning: () => Promise.resolve(rows),
    limit: () => Promise.resolve(rows),
  });
}

function updateChain(sink: Record<string, unknown>[], rows: unknown[]) {
  return {
    set: (values: Record<string, unknown>) => {
      sink.push(values);
      return { where: () => whereResult(rows) };
    },
  };
}

function makeTx(selectRows: unknown[][], updateRows: unknown[]) {
  let call = 0;
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[][] = [];
  const tx = {
    select: jest.fn(() => ({
      from: () => ({ where: () => whereResult(selectRows[call++] ?? []) }),
    })),
    update: jest.fn(() => updateChain(updates, updateRows)),
    insert: jest.fn(() => ({
      values: (values: Record<string, unknown>[]) => {
        inserts.push(values);
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    })),
  };
  return { tx, updates, inserts };
}

describe('Admin ReportsService take-downs', () => {
  let db: MockDb;
  let service: ReportsService;

  beforeEach(() => {
    db = makeDb();
    service = new ReportsService(db as never);
  });

  it('approving a listing report takes the listing down in one transaction', async () => {
    db.select.mockReturnValue(
      limitChain([{ id: REPORT, listingId: LISTING, reporterId: REPORTER }]),
    );
    const { tx, updates } = makeTx([], [{ id: REPORT, status: 'approved' }]);
    db.transaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    );

    const row = await service.updateListingReportStatus(
      REPORT,
      { status: 'approved' },
      REVIEWER,
    );

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(updates).toContainEqual({
      status: 'deleted',
      takenDownAt: expect.any(Date) as unknown as Date,
      updatedAt: expect.any(Date) as unknown as Date,
    });
    expect(updates).toContainEqual({
      status: 'approved',
      reviewedById: REVIEWER,
    });
    expect(row).toMatchObject({ status: 'approved' });
  });

  it('rejecting a listing report never touches the listing', async () => {
    db.select.mockReturnValue(
      limitChain([{ id: REPORT, listingId: LISTING, reporterId: REPORTER }]),
    );
    const updates: Record<string, unknown>[] = [];
    db.update.mockReturnValue(
      updateChain(updates, [{ id: REPORT, status: 'rejected' }]),
    );

    await service.updateListingReportStatus(
      REPORT,
      { status: 'rejected' },
      REVIEWER,
    );

    expect(db.transaction).not.toHaveBeenCalled();
    expect(updates).toEqual([{ status: 'rejected', reviewedById: REVIEWER }]);
  });

  it('approving a user report suspends the account and bans every phone', async () => {
    db.select.mockReturnValue(
      limitChain([{ id: REPORT, targetUserId: TARGET_USER }]),
    );
    const { tx, updates, inserts } = makeTx(
      [
        [{ primaryPhone: '855123' }],
        [{ phone: '+855999' }, { phone: '855123' }],
      ],
      [{ id: REPORT, status: 'approved' }],
    );
    db.transaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    );

    await service.updateUserReportStatus(
      REPORT,
      { status: 'approved' },
      REVIEWER,
    );

    expect(updates).toContainEqual({
      status: 'suspended',
      updatedAt: expect.any(Date) as unknown as Date,
    });
    // The account's live ads go down in the same transaction.
    expect(updates).toContainEqual({
      status: 'deleted',
      takenDownAt: expect.any(Date) as unknown as Date,
      updatedAt: expect.any(Date) as unknown as Date,
    });
    expect(updates).toContainEqual({
      status: 'approved',
      reviewedById: REVIEWER,
    });
    expect(inserts).toHaveLength(1);
    // Primary-first, normalized to E.164, deduped across both sources.
    expect(inserts[0]).toEqual([
      {
        phone: '+855123',
        userId: TARGET_USER,
        reportId: REPORT,
        bannedById: REVIEWER,
      },
      {
        phone: '+855999',
        userId: TARGET_USER,
        reportId: REPORT,
        bannedById: REVIEWER,
      },
    ]);
  });

  it('rejecting a user report never bans a phone', async () => {
    db.select.mockReturnValue(
      limitChain([{ id: REPORT, targetUserId: TARGET_USER }]),
    );
    const updates: Record<string, unknown>[] = [];
    db.update.mockReturnValue(
      updateChain(updates, [{ id: REPORT, status: 'rejected' }]),
    );

    await service.updateUserReportStatus(
      REPORT,
      { status: 'rejected' },
      REVIEWER,
    );

    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(updates).toEqual([{ status: 'rejected', reviewedById: REVIEWER }]);
  });

  it('rejecting an already-approved listing report does not restore it', async () => {
    // Pinned on purpose: a future "helpful" patch that restores content on
    // rejection would silently republish listings the owner had already
    // removed. The verdict changes; the take-down is permanent.
    db.select.mockReturnValue(
      limitChain([{ id: REPORT, listingId: LISTING, status: 'approved' }]),
    );
    const updates: Record<string, unknown>[] = [];
    db.update.mockReturnValue(
      updateChain(updates, [{ id: REPORT, status: 'rejected' }]),
    );

    await service.updateListingReportStatus(
      REPORT,
      { status: 'rejected' },
      REVIEWER,
    );

    expect(db.transaction).not.toHaveBeenCalled();
    expect(updates).toEqual([{ status: 'rejected', reviewedById: REVIEWER }]);
  });

  it('404s an unknown report id for both target types', async () => {
    db.select.mockReturnValue(limitChain([]));

    await expect(
      service.updateUserReportStatus(REPORT, { status: 'approved' }, REVIEWER),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.updateListingReportStatus(
        REPORT,
        { status: 'approved' },
        REVIEWER,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
