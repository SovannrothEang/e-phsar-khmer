import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ListingsService } from './listings.service';
import { listings } from '../db/schema/listings.schema';

function makeDb() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };
}

type DbMock = ReturnType<typeof makeDb>;

function makeEntitlements() {
  return {
    assertPhotos: jest.fn().mockResolvedValue(undefined),
    assertCanHoldAnotherAd: jest.fn().mockResolvedValue(undefined),
    assertCanRenew: jest.fn().mockResolvedValue(undefined),
    reconcileListingsSafely: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService(db: DbMock, entitlements = makeEntitlements()) {
  const reactionsService = {
    countLikes: jest.fn().mockResolvedValue(0),
  };
  const productsService = {
    getPublishedRefByModelId: jest.fn().mockResolvedValue(null),
  };
  const service = new ListingsService(
    db as never,
    {} as never,
    reactionsService as never,
    entitlements as never,
    productsService as never,
  );
  return { service, entitlements };
}

/** A select chain that resolves at `.limit()`. */
function selectLimit(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.limit = () => Promise.resolve(result);
  return chain;
}

type Capture = { values?: Record<string, unknown> };

/** An update chain that captures the `.set()` values. */
function updateReturning(result: unknown[], capture: Capture = {}) {
  return {
    set: (values: Record<string, unknown>) => {
      capture.values = values;
      return {
        where: () => ({
          returning: () => Promise.resolve(result),
        }),
      };
    },
  };
}

function listingRow(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'l1',
    userId: 'u1',
    title: 'A motorcycle',
    status: 'active',
    publishedAt: new Date(now - 86_400_000),
    expiresAt: new Date(now + 86_400_000),
    renewCount: 1,
    photos: [],
    moderatedAt: null,
    ...overrides,
  };
}

describe('ListingsService.inactivate', () => {
  let db: DbMock;

  beforeEach(() => {
    db = makeDb();
  });

  it('hides the ad, records the moderator and reconciles the plan', async () => {
    const { service, entitlements } = makeService(db);
    const capture: Capture = {};
    db.select.mockReturnValue(
      selectLimit([
        { moderatedAt: null, status: 'active', publishedAt: new Date() },
      ]),
    );
    db.update.mockReturnValue(
      updateReturning(
        [
          {
            id: 'l1',
            userId: 'u1',
            status: 'inactive',
            inactiveAt: new Date(),
          },
        ],
        capture,
      ),
    );

    const row = await service.inactivate('l1', 'm1', 'Missing required specs');

    expect(row.status).toBe('inactive');
    expect(capture.values).toMatchObject({
      status: 'inactive',
      inactiveById: 'm1',
      inactiveReason: 'Missing required specs',
    });
    expect(capture.values?.inactiveAt).toBeInstanceOf(Date);
    // Hiding the ad frees a live slot — reconcile immediately.
    expect(entitlements.reconcileListingsSafely).toHaveBeenCalledWith('u1');
  });

  it('refuses a permanently removed ad (removal wins)', async () => {
    const { service } = makeService(db);
    db.select.mockReturnValue(
      selectLimit([
        { moderatedAt: new Date(), status: 'deleted', publishedAt: new Date() },
      ]),
    );

    await expect(service.inactivate('l1', 'm1', 'x')).rejects.toThrow(
      BadRequestException,
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('allows a live legacy row that has no publish stamp', async () => {
    // Seeded/legacy ads are live by status + expiry while `publishedAt` stays
    // null — the admin sees them, so they must be inactivatable.
    const { service } = makeService(db);
    db.select.mockReturnValue(
      selectLimit([{ moderatedAt: null, status: 'active' }]),
    );
    db.update.mockReturnValue(
      updateReturning([{ id: 'l1', userId: 'u1', status: 'inactive' }]),
    );

    const row = await service.inactivate('l1', 'm1', 'spam');

    expect(row.status).toBe('inactive');
  });

  it('404s an unknown id', async () => {
    const { service } = makeService(db);
    db.select.mockReturnValue(selectLimit([]));

    await expect(service.inactivate('nope', 'm1', 'x')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ListingsService.publish from inactive', () => {
  let db: DbMock;

  beforeEach(() => {
    db = makeDb();
  });

  it('reactivates free while the window is open, keeping the expiry', async () => {
    const { service, entitlements } = makeService(db);
    const existing = listingRow({ status: 'inactive' });
    jest.spyOn(service, 'findById').mockResolvedValue(existing as never);
    const capture: Capture = {};
    db.update.mockReturnValue(
      updateReturning([{ ...existing, status: 'active' }], capture),
    );

    await service.publish('u1', 'l1');

    // Not a renewal: no spend, no insert, no new expiry.
    expect(entitlements.assertCanRenew).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    // The hidden ad no longer held a slot, so coming back must claim one.
    expect(entitlements.assertCanHoldAnotherAd).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ id: 'l1' }),
    );
    expect(capture.values).toMatchObject({
      status: 'active',
      inactiveAt: null,
      inactiveById: null,
      inactiveReason: null,
    });
    expect(capture.values).not.toHaveProperty('expiresAt');
    expect(capture.values).not.toHaveProperty('renewCount');
    expect(entitlements.reconcileListingsSafely).toHaveBeenCalledWith('u1');
  });

  it('renews a lapsed inactive ad like any expired ad', async () => {
    const { service, entitlements } = makeService(db);
    const past = new Date(Date.now() - 40 * 86_400_000);
    const existing = listingRow({
      status: 'inactive',
      publishedAt: past,
      expiresAt: new Date(Date.now() - 86_400_000),
      renewCount: 2,
    });
    jest.spyOn(service, 'findById').mockResolvedValue(existing as never);
    const capture: Capture = {};
    db.transaction.mockImplementation((fn: (tx: DbMock) => unknown) => fn(db));
    db.update.mockReturnValue(
      updateReturning([{ ...existing, status: 'active' }], capture),
    );
    const values = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values });

    await service.publish('u1', 'l1');

    expect(entitlements.assertCanRenew).toHaveBeenCalled();
    expect(entitlements.assertCanHoldAnotherAd).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({ listingId: 'l1', userId: 'u1' });
    expect(capture.values).toMatchObject({
      status: 'active',
      renewCount: 3,
      inactiveAt: null,
      inactiveById: null,
      inactiveReason: null,
    });
  });

  it('a permanently removed ad is still refused', async () => {
    const { service } = makeService(db);
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue(
        listingRow({ status: 'deleted', moderatedAt: new Date() }) as never,
      );

    await expect(service.publish('u1', 'l1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('ListingsService staff restore', () => {
  let db: DbMock;

  beforeEach(() => {
    db = makeDb();
  });

  it('dispatches a removed ad to restoreModerated', async () => {
    const { service } = makeService(db);
    db.select.mockReturnValue(
      selectLimit([{ moderatedAt: new Date(), status: 'deleted' }]),
    );
    const restore = jest
      .spyOn(service, 'restoreModerated')
      .mockResolvedValue({} as never);

    await service.restoreStaffHidden('l1');

    expect(restore).toHaveBeenCalledWith('l1');
  });

  it('dispatches an inactive ad to restoreInactive', async () => {
    const { service } = makeService(db);
    db.select.mockReturnValue(
      selectLimit([{ moderatedAt: null, status: 'inactive' }]),
    );
    const restore = jest
      .spyOn(service, 'restoreInactive')
      .mockResolvedValue({} as never);

    await service.restoreStaffHidden('l1');

    expect(restore).toHaveBeenCalledWith('l1');
  });

  it('refuses a row that is neither removed nor inactive', async () => {
    const { service } = makeService(db);
    db.select.mockReturnValue(
      selectLimit([{ moderatedAt: null, status: 'active' }]),
    );

    await expect(service.restoreStaffHidden('l1')).rejects.toThrow(
      'LISTING_NOT_MODERATED',
    );
  });

  it('restoreInactive brings the ad back live and clears the hide', async () => {
    const { service, entitlements } = makeService(db);
    const existing = listingRow({ status: 'inactive' });
    db.select.mockReturnValue(selectLimit([existing]));
    const capture: Capture = {};
    db.update.mockReturnValue(
      updateReturning([{ ...existing, status: 'active' }], capture),
    );

    await service.restoreInactive('l1');

    expect(capture.values).toMatchObject({
      status: 'active',
      inactiveAt: null,
      inactiveById: null,
      inactiveReason: null,
    });
    expect(entitlements.reconcileListingsSafely).toHaveBeenCalledWith('u1');
  });

  it('restoreInactive lands a live legacy row as active, not draft', async () => {
    // A seeded ad has an expiry but no publish stamp; restoring it must put
    // it back on the platform rather than turning it into a draft.
    const { service } = makeService(db);
    const existing = listingRow({ status: 'inactive', publishedAt: null });
    db.select.mockReturnValue(selectLimit([existing]));
    const capture: Capture = {};
    db.update.mockReturnValue(
      updateReturning([{ ...existing, status: 'active' }], capture),
    );

    await service.restoreInactive('l1');

    expect(capture.values).toMatchObject({ status: 'active' });
  });

  it('restoreInactive lands a lapsed ad as expired', async () => {
    const { service } = makeService(db);
    const existing = listingRow({
      status: 'inactive',
      expiresAt: new Date(Date.now() - 60_000),
    });
    db.select.mockReturnValue(selectLimit([existing]));
    const capture: Capture = {};
    db.update.mockReturnValue(
      updateReturning([{ ...existing, status: 'expired' }], capture),
    );

    await service.restoreInactive('l1');

    expect(capture.values).toMatchObject({ status: 'expired' });
  });
});

describe('ListingsService public detail and owner tabs', () => {
  type Rec = Record<string, unknown[]>;
  const dialect = new PgDialect();
  let db: DbMock;

  beforeEach(() => {
    db = makeDb();
  });

  function chain(result: unknown[], rec: Rec) {
    const c: Record<string, unknown> = {};
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'leftJoin',
    ]) {
      c[m] = (...args: unknown[]) => {
        rec[m] = args;
        return c;
      };
    }
    c.then = (
      resolve: (v: unknown[]) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return c;
  }

  function queue(...results: unknown[][]): Rec[] {
    const recs: Rec[] = results.map(() => ({}));
    let i = 0;
    db.select.mockImplementation(() => {
      const rec = recs[i] ?? {};
      if (i >= recs.length) recs.push(rec);
      return chain(results[i++] ?? [], rec);
    });
    return recs;
  }

  const whereOf = (rec: Rec) => dialect.sqlToQuery(rec.where[0] as never);

  it('hides an inactive ad from the public detail route', async () => {
    const { service } = makeService(db);
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      return call === 1
        ? chain(
            [
              {
                listing: listingRow({
                  status: 'inactive',
                  inactiveReason: 'spam',
                }),
                sellerUsername: 'seller',
              },
            ],
            {},
          )
        : chain([], {});
    });

    await expect(service.findPublicById('l1')).rejects.toThrow(
      'Listing not found',
    );
  });

  it('filters the Inactive tab by the stored status', async () => {
    const { service } = makeService(db);
    const recs = queue([{ count: 0 }], []);

    await service.findMine('u1', { status: 'inactive' });

    const { sql: text, params } = whereOf(recs[1]);
    expect(text).toContain('"listings"."status"');
    expect(params).toContain('inactive');
  });
});

describe('listing status enum', () => {
  it('carries the staff-hidden value', () => {
    expect(listings.status.enumValues).toContain('inactive');
  });
});
