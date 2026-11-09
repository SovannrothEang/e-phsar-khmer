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
  const notifications = {
    notifyStaff: jest.fn().mockResolvedValue(undefined),
    removeForListing: jest.fn().mockResolvedValue({ deleted: 0 }),
  };
  const service = new ListingsService(
    db as never,
    {} as never,
    reactionsService as never,
    entitlements as never,
    productsService as never,
    notifications as never,
  );
  return { service, entitlements, notifications };
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

describe('ListingsService.publish from a staff-hidden or deleted ad', () => {
  let db: DbMock;

  beforeEach(() => {
    db = makeDb();
  });

  it('refuses the owner republish that used to be free', async () => {
    // 2026-11-08: lifting an inactivation is staff work too. The owner used to
    // flip it back themselves while the 30-day window was open.
    const { service, entitlements, notifications } = makeService(db);
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue(listingRow({ status: 'inactive' }) as never);

    await expect(service.publish('u1', 'l1')).rejects.toMatchObject({
      response: { code: 'LISTING_INACTIVE_BY_STAFF' },
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(entitlements.assertCanHoldAnotherAd).not.toHaveBeenCalled();
    expect(notifications.removeForListing).not.toHaveBeenCalled();
  });

  it('refuses a lapsed inactive ad too — the owner path is gone entirely', async () => {
    const { service } = makeService(db);
    jest.spyOn(service, 'findById').mockResolvedValue(
      listingRow({
        status: 'inactive',
        publishedAt: new Date(Date.now() - 40 * 86_400_000),
        expiresAt: new Date(Date.now() - 86_400_000),
      }) as never,
    );

    await expect(service.publish('u1', 'l1')).rejects.toMatchObject({
      response: { code: 'LISTING_INACTIVE_BY_STAFF' },
    });
  });

  it('refuses a permanently deleted ad', async () => {
    const { service } = makeService(db);
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue(
        listingRow({ status: 'deleted', deletedAt: new Date() }) as never,
      );

    await expect(service.publish('u1', 'l1')).rejects.toMatchObject({
      response: { code: 'LISTING_DELETED_PERMANENTLY' },
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

  it('refuses to restore a permanently deleted ad', async () => {
    const { service } = makeService(db);
    db.select.mockReturnValue(
      selectLimit([
        { moderatedAt: new Date(), deletedAt: new Date(), status: 'deleted' },
      ]),
    );

    await expect(service.restoreStaffHidden('l1')).rejects.toThrow(
      'LISTING_DELETED_PERMANENTLY',
    );
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
    const { service, entitlements, notifications } = makeService(db);
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
    expect(notifications.removeForListing).toHaveBeenCalledWith(
      'l1',
      ['listing.inactivated'],
      'u1',
    );
  });

  it('restoreModerated clears the removal notice', async () => {
    const { service, notifications } = makeService(db);
    const existing = listingRow({
      status: 'deleted',
      moderatedAt: new Date(),
    });
    db.select.mockReturnValue(selectLimit([existing]));
    db.update.mockReturnValue(
      updateReturning([{ ...existing, status: 'active' }]),
    );

    await service.restoreModerated('l1');

    expect(notifications.removeForListing).toHaveBeenCalledWith(
      'l1',
      ['listing.removed'],
      'u1',
    );
  });

  it('still restores the ad when clearing the stale notice fails', async () => {
    const { service, notifications } = makeService(db);
    const existing = listingRow({
      status: 'deleted',
      moderatedAt: new Date(),
    });
    db.select.mockReturnValue(selectLimit([existing]));
    db.update.mockReturnValue(
      updateReturning([{ ...existing, status: 'active' }]),
    );
    notifications.removeForListing.mockRejectedValue(new Error('db down'));

    await expect(service.restoreModerated('l1')).resolves.toMatchObject({
      status: 'active',
    });
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
