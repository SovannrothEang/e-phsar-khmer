import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

const reviewer = { id: 'admin-1', role: 'admin' as const };

/** A chain where every builder step returns itself and awaiting yields `rows`. */
function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const k of ['from', 'leftJoin', 'where', 'limit', 'set']) {
    c[k] = () => c;
  }
  c.for = () => Promise.resolve(rows);
  c.returning = () => Promise.resolve(rows);
  c.then = (resolve: (v: unknown[]) => unknown) =>
    Promise.resolve(rows).then(resolve);
  return c;
}

function setup(found: unknown[]) {
  const sets: unknown[] = [];
  const tx = {
    select: jest.fn(() => chain(found)),
    update: jest.fn(() => {
      const c = chain([{ id: 'r1' }]);
      const set = c.set as () => unknown;
      c.set = (v: unknown) => {
        sets.push(v);
        return set();
      };
      return c;
    }),
  };
  const db = { transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)) };
  const listing = {
    id: 'l1',
    userId: 'u1',
    title: 'A motorcycle',
    status: 'deleted',
    moderatedAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
  };
  const listings = { moderate: jest.fn().mockResolvedValue(listing) };
  const admin = { authorizeManage: jest.fn().mockResolvedValue(undefined) };
  const adminListings = {
    notifyOwnerOfModeration: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ReportsService(
    db as never,
    listings as never,
    admin as never,
    {} as never,
    adminListings as never,
  );
  return { service, tx, sets, listings, admin, adminListings, listing };
}

describe('ReportsService.updateListingReportStatus', () => {
  const pending = {
    report: { id: 'r1', listingId: 'l1', status: 'pending' },
    reason: 'Scam',
  };

  it('takes the listing down inside the same transaction on approval', async () => {
    const { service, tx, listings } = setup([pending]);
    await service.updateListingReportStatus(
      'r1',
      { status: 'approved' },
      reviewer,
    );
    expect(listings.moderate).toHaveBeenCalledWith(
      'l1',
      'admin-1',
      'Reported: Scam',
      tx,
    );
  });

  it('closes the other pending reports on that listing', async () => {
    const { service, sets } = setup([pending]);
    await service.updateListingReportStatus(
      'r1',
      { status: 'approved' },
      reviewer,
    );
    expect(sets).toHaveLength(2);
    expect(sets[1]).toEqual({ status: 'approved', reviewedById: 'admin-1' });
  });

  it('does nothing to the listing on rejection', async () => {
    const { service, listings } = setup([pending]);
    await service.updateListingReportStatus(
      'r1',
      { status: 'rejected' },
      reviewer,
    );
    expect(listings.moderate).not.toHaveBeenCalled();
  });

  it('does not re-moderate an already approved report', async () => {
    const { service, listings, adminListings } = setup([
      { ...pending, report: { ...pending.report, status: 'approved' } },
    ]);
    await service.updateListingReportStatus(
      'r1',
      { status: 'approved' },
      reviewer,
    );
    expect(listings.moderate).not.toHaveBeenCalled();
    expect(adminListings.notifyOwnerOfModeration).not.toHaveBeenCalled();
  });

  it('tells the owner once, with the report reason, after the take-down commits', async () => {
    const { service, adminListings, listing } = setup([pending]);
    await service.updateListingReportStatus(
      'r1',
      { status: 'approved' },
      reviewer,
    );
    expect(adminListings.notifyOwnerOfModeration).toHaveBeenCalledTimes(1);
    expect(adminListings.notifyOwnerOfModeration).toHaveBeenCalledWith(
      listing,
      'removed',
      'Reported: Scam',
    );
  });

  it('sends no notice when the moderation transaction rolls back', async () => {
    const { service, listings, adminListings } = setup([pending]);
    listings.moderate.mockRejectedValue(new Error('db down'));
    await expect(
      service.updateListingReportStatus('r1', { status: 'approved' }, reviewer),
    ).rejects.toThrow('db down');
    expect(adminListings.notifyOwnerOfModeration).not.toHaveBeenCalled();
  });

  it('does not send a second notice for an already-moderated listing', async () => {
    const { service, listings, adminListings } = setup([
      { ...pending, listingModeratedAt: new Date() },
    ]);
    await service.updateListingReportStatus(
      'r1',
      { status: 'approved' },
      reviewer,
    );
    expect(listings.moderate).toHaveBeenCalledTimes(1);
    expect(adminListings.notifyOwnerOfModeration).not.toHaveBeenCalled();
  });

  it('sends no notice on rejection', async () => {
    const { service, adminListings } = setup([pending]);
    await service.updateListingReportStatus(
      'r1',
      { status: 'rejected' },
      reviewer,
    );
    expect(adminListings.notifyOwnerOfModeration).not.toHaveBeenCalled();
  });

  it('404s an unknown report', async () => {
    const { service } = setup([]);
    await expect(
      service.updateListingReportStatus('r1', { status: 'approved' }, reviewer),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ReportsService.updateUserReportStatus', () => {
  const pending = { id: 'r1', targetUserId: 'u9', status: 'pending' };

  it('suspends the target through the admin account rules on approval', async () => {
    const { service, tx, sets, admin } = setup([pending]);
    await service.updateUserReportStatus(
      'r1',
      { status: 'approved' },
      reviewer,
    );
    expect(admin.authorizeManage).toHaveBeenCalledWith(tx, reviewer, 'u9', {
      status: 'suspended',
    });
    expect(sets[1]).toMatchObject({ status: 'suspended' });
  });

  it('propagates a policy refusal (e.g. an admin reporting staff)', async () => {
    const { service, admin } = setup([pending]);
    admin.authorizeManage.mockRejectedValue(new Error('forbidden'));
    await expect(
      service.updateUserReportStatus('r1', { status: 'approved' }, reviewer),
    ).rejects.toThrow('forbidden');
  });

  it('leaves the account alone on rejection', async () => {
    const { service, admin, sets } = setup([pending]);
    await service.updateUserReportStatus(
      'r1',
      { status: 'rejected' },
      reviewer,
    );
    expect(admin.authorizeManage).not.toHaveBeenCalled();
    expect(sets).toHaveLength(1);
  });
});
