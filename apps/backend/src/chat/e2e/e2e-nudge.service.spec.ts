import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { NotificationPayload } from '../../notifications/notification-channel.interface';
import {
  E2E_NUDGE_NOTIFICATION_TYPE,
  E2eNudgeService,
} from './e2e-nudge.service';

// .from().where().limit() → rows
function limitQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

function makeDb() {
  return { select: jest.fn() };
}

function makeNotifications() {
  return {
    notify: jest
      .fn<Promise<void>, [NotificationPayload]>()
      .mockResolvedValue(undefined),
  };
}

describe('E2eNudgeService.nudge', () => {
  let db: ReturnType<typeof makeDb>;
  let notifications: ReturnType<typeof makeNotifications>;
  let service: E2eNudgeService;

  beforeEach(() => {
    db = makeDb();
    notifications = makeNotifications();
    service = new E2eNudgeService(db as never, notifications as never);
  });

  /** select() call order: [0] recipient exists, [1] block check, [2] 24h dedupe, [3] listing (optional) */
  function queueSelects(rows: unknown[][]) {
    db.select.mockImplementation(() => limitQuery(rows.shift() ?? []));
  }

  it('404s for an unknown recipient — before any block or dedupe lookup', async () => {
    queueSelects([[]]); // recipient lookup → no row

    await expect(service.nudge('sender-1', 'ghost', {})).rejects.toThrow(
      NotFoundException,
    );
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('refuses a blocked pair', async () => {
    queueSelects([
      [{ id: 'recipient-1' }], // recipient exists
      [{ id: 'block-row' }], // isBlockedEitherWay finds a block row
    ]);

    await expect(service.nudge('sender-1', 'recipient-1', {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('creates a content-free notification with no body and no sender text', async () => {
    queueSelects([
      [{ id: 'recipient-1' }], // recipient exists
      [], // not blocked
      [], // no recent nudge
    ]);

    const result = await service.nudge('sender-1', 'recipient-1', {});

    expect(result).toEqual({ sent: true });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const payload = notifications.notify.mock.calls[0][0];
    expect(payload.userId).toBe('recipient-1');
    expect(payload.type).toBe(E2E_NUDGE_NOTIFICATION_TYPE);
    expect(payload.body).toBeUndefined();
    expect(payload.title).not.toMatch(/sender-1/);
    expect(payload.data).toEqual({
      senderId: 'sender-1',
      listingId: null,
      listingTitle: null,
    });
  });

  it('includes only the listing title when listingId is given and the listing exists', async () => {
    queueSelects([
      [{ id: 'recipient-1' }], // recipient exists
      [], // not blocked
      [], // no recent nudge
      [{ title: 'Toyota Camry 2015' }], // listing lookup
    ]);

    await service.nudge('sender-1', 'recipient-1', {
      listingId: 'listing-1',
    });

    const payload = notifications.notify.mock.calls[0][0];
    expect(payload.title).toContain('Toyota Camry 2015');
    expect(payload.data).toEqual({
      senderId: 'sender-1',
      listingId: 'listing-1',
      listingTitle: 'Toyota Camry 2015',
    });
  });

  it('a second call within 24h is a no-op — no second notification', async () => {
    queueSelects([
      [{ id: 'recipient-1' }], // recipient exists
      [], // not blocked
      [{ id: 'existing-notification' }], // a recent nudge already exists
    ]);

    const result = await service.nudge('sender-1', 'recipient-1', {});

    expect(result).toEqual({ sent: false });
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
