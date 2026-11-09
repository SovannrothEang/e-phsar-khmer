import { NotFoundException } from '@nestjs/common';
import { AdminListingsService } from './admin-listings.service';
import type { ListingRow } from '../db/schema/listings.schema';
import type { NotificationPayload } from '../notifications/notification-channel.interface';

function moderationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    userId: 'u1',
    title: 'A motorcycle',
    status: 'active',
    expiresAt: new Date(Date.now() + 86_400_000),
    moderatedAt: null,
    ...overrides,
  };
}

function makeDb(state: Record<string, unknown> | null) {
  return {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(state ? [state] : []) }),
      }),
    })),
  };
}

function makeService(
  db: ReturnType<typeof makeDb>,
  row: Record<string, unknown> = moderationRow(),
) {
  const listingsService = {
    moderate: jest.fn().mockResolvedValue(row),
    inactivate: jest.fn().mockResolvedValue(row),
    restoreStaffHidden: jest.fn().mockResolvedValue(row),
  };
  const notifications = {
    notify: jest.fn<Promise<void>, [NotificationPayload]>(),
  };
  const service = new AdminListingsService(
    db as never,
    listingsService as never,
    notifications as never,
  );
  return { service, listingsService, notifications };
}

describe('AdminListingsService.remove', () => {
  it('takes the ad down and tells the seller why', async () => {
    const db = makeDb({ status: 'active', moderatedAt: null });
    const row = moderationRow({ status: 'deleted', moderatedAt: new Date() });
    const { service, listingsService, notifications } = makeService(db, row);

    await service.remove('l1', 'm1', '  Counterfeit goods  ');

    expect(listingsService.moderate).toHaveBeenCalledWith(
      'l1',
      'm1',
      '  Counterfeit goods  ',
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const notice = notifications.notify.mock.calls[0][0];
    expect(notice).toMatchObject({
      userId: 'u1',
      type: 'listing.removed',
      data: { listingId: 'l1', action: 'removed' },
    });
    expect(notice.title).toBe(
      'Your ad "A motorcycle" was removed by an administrator',
    );
    expect(notice.body).toContain('Counterfeit goods');
  });

  it('does not send a second notice for an already-removed ad', async () => {
    const db = makeDb({ status: 'deleted', moderatedAt: new Date() });
    const { service, notifications } = makeService(
      db,
      moderationRow({ status: 'deleted', moderatedAt: new Date() }),
    );

    await service.remove('l1', 'm1', 'again');

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('404s an unknown id before moderating', async () => {
    const db = makeDb(null);
    const { service, listingsService } = makeService(db);

    await expect(service.remove('nope', 'm1', 'x')).rejects.toThrow(
      NotFoundException,
    );
    expect(listingsService.moderate).not.toHaveBeenCalled();
  });
});

describe('AdminListingsService.inactivate', () => {
  it('hides the ad and tells the seller that staff must lift it', async () => {
    const db = makeDb({ status: 'active', moderatedAt: null });
    const row = moderationRow({ status: 'inactive' });
    const { service, listingsService, notifications } = makeService(db, row);

    await service.inactivate('l1', 'm1', 'Wrong category');

    expect(listingsService.inactivate).toHaveBeenCalledWith(
      'l1',
      'm1',
      'Wrong category',
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const notice = notifications.notify.mock.calls[0][0];
    expect(notice).toMatchObject({
      userId: 'u1',
      type: 'listing.inactivated',
      data: { listingId: 'l1', action: 'inactive' },
    });
    expect(notice.title).toBe('Your ad "A motorcycle" was set inactive');
    expect(notice.body).toContain('Wrong category');
    // Since 2026-11-08 the owner's republish is refused, so the notice must
    // not promise one — it names staff and support instead.
    expect(notice.body).toContain('only an administrator');
    expect(notice.body).toContain('contact support');
    expect(notice.body).not.toContain('publish again');
    expect(notice.body).not.toContain('renewal');
  });

  it('does not re-notify an already-inactive ad', async () => {
    const db = makeDb({ status: 'inactive', moderatedAt: null });
    const { service, notifications } = makeService(
      db,
      moderationRow({ status: 'inactive' }),
    );

    await service.inactivate('l1', 'm1', 'again');

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('swallows a notification failure after the hide committed', async () => {
    const db = makeDb({ status: 'active', moderatedAt: null });
    const { service, notifications } = makeService(db);
    notifications.notify.mockRejectedValue(new Error('redis down'));

    await expect(
      service.inactivate('l1', 'm1', 'Wrong category'),
    ).resolves.toMatchObject({ id: 'l1' });
  });

  it('clips a long listing title in the notice', async () => {
    const db = makeDb({ status: 'active', moderatedAt: null });
    const row = moderationRow({ title: 'x'.repeat(400) });
    const { service, notifications } = makeService(db, row);

    await service.inactivate('l1', 'm1', 'Wrong category');

    const notice = notifications.notify.mock.calls[0][0] as {
      title: string;
      data: { listingTitle: string };
    };
    expect(notice.title.length).toBeLessThanOrEqual(200);
    expect(notice.title).toContain('…');
    expect(notice.data.listingTitle).toBe('x'.repeat(400));
  });
});

describe('AdminListingsService.notifyOwnerOfModeration', () => {
  it('builds the removal notice the report-approval path sends', async () => {
    const db = makeDb({ status: 'active', moderatedAt: null });
    const row = moderationRow({ status: 'deleted', moderatedAt: new Date() });
    const { service, notifications } = makeService(db, row);

    await service.notifyOwnerOfModeration(
      row as unknown as ListingRow,
      'removed',
      'Reported: Scam',
    );

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      type: 'listing.removed',
      data: { listingId: 'l1', action: 'removed', reason: 'Reported: Scam' },
    });
  });

  it('swallows a notification failure so the committed approval stands', async () => {
    const db = makeDb({ status: 'active', moderatedAt: null });
    const row = moderationRow({ status: 'deleted', moderatedAt: new Date() });
    const { service, notifications } = makeService(db, row);
    notifications.notify.mockRejectedValue(new Error('redis down'));

    await expect(
      service.notifyOwnerOfModeration(
        row as unknown as ListingRow,
        'removed',
        'Reported: Scam',
      ),
    ).resolves.toBeUndefined();
  });
});

describe('AdminListingsService.restore', () => {
  it('delegates to the staff restore dispatcher', async () => {
    const db = makeDb({ status: 'inactive', moderatedAt: null });
    const { service, listingsService } = makeService(db);

    await service.restore('l1');

    expect(listingsService.restoreStaffHidden).toHaveBeenCalledWith('l1');
  });
});

describe('AdminListingRow shape', () => {
  it('carries the inactive fields the dashboard labels', () => {
    // Type-level guard: the row interface exposes both staff states.
    const row: Partial<ListingRow> = {
      inactiveAt: new Date(),
      inactiveReason: 'spam',
    };
    expect(row.inactiveReason).toBe('spam');
  });
});
