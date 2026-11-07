import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserReportsService } from './reports.service';
import type { NotificationPayload } from '../notifications/notification-channel.interface';

const limitChain = (rows: unknown[]) => ({
  from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
});

function setup(selects: unknown[][], insertResult: Promise<unknown[]>) {
  let call = 0;
  const db = {
    select: jest.fn(() => limitChain(selects[call++] ?? [])),
    insert: jest.fn(() => ({
      values: () => ({ returning: () => insertResult }),
    })),
  };
  const files = {
    isOwnedPath: (p: string, u: string) => p.startsWith(`report/${u}/`),
  };
  const notifications = {
    notifyStaff: jest.fn<
      Promise<void>,
      [Omit<NotificationPayload, 'userId'>]
    >(),
  };
  notifications.notifyStaff.mockResolvedValue(undefined);
  return {
    service: new UserReportsService(
      db as never,
      files as never,
      notifications as never,
    ),
    db,
    notifications,
  };
}

const dto = { listingId: 'l1', reasonId: 'r1' };

describe('UserReportsService.reportListing', () => {
  it('files a report', async () => {
    const { service } = setup(
      [[{ userId: 'owner', moderatedAt: null }], [{ reason: 'Spam' }]],
      Promise.resolve([{ id: 'rep1' }]),
    );
    await expect(service.reportListing('me', dto)).resolves.toEqual({
      id: 'rep1',
    });
  });

  it('tells staff about the new listing report without the reporter', async () => {
    const { service, notifications } = setup(
      [[{ userId: 'owner', moderatedAt: null }], [{ reason: 'Spam' }]],
      Promise.resolve([{ id: 'rep1' }]),
    );

    await service.reportListing('me', dto);

    const [payload] = notifications.notifyStaff.mock.calls[0];
    expect(payload.type).toBe('report.created');
    expect(payload.title).toBe('New listing report');
    expect(payload.body).toContain('Spam');
    expect(payload.data).toEqual({
      reportId: 'rep1',
      targetType: 'listing',
      targetId: 'l1',
      reason: 'Spam',
    });
    expect(payload.data).not.toHaveProperty('reporterId');
  });

  it('still files the report when the staff notice fails', async () => {
    const { service, notifications } = setup(
      [[{ userId: 'owner', moderatedAt: null }], [{ reason: 'Spam' }]],
      Promise.resolve([{ id: 'rep1' }]),
    );
    notifications.notifyStaff.mockRejectedValue(new Error('db down'));

    await expect(service.reportListing('me', dto)).resolves.toEqual({
      id: 'rep1',
    });
  });

  it('refuses reporting your own listing', async () => {
    const { service } = setup(
      [[{ userId: 'me', moderatedAt: null }]],
      Promise.resolve([]),
    );
    await expect(service.reportListing('me', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('404s a removed listing', async () => {
    const { service } = setup(
      [[{ userId: 'owner', moderatedAt: new Date() }]],
      Promise.resolve([]),
    );
    await expect(service.reportListing('me', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a reason of the wrong target type', async () => {
    const { service } = setup(
      [[{ userId: 'owner', moderatedAt: null }], []],
      Promise.resolve([]),
    );
    await expect(service.reportListing('me', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('turns a second open report into 409', async () => {
    const { service } = setup(
      [[{ userId: 'owner', moderatedAt: null }], [{ reason: 'Spam' }]],
      Promise.reject(Object.assign(new Error('duplicate'), { code: '23505' })),
    );
    await expect(service.reportListing('me', dto)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('UserReportsService.reportUser', () => {
  it('refuses reporting yourself', async () => {
    const { service } = setup([], Promise.resolve([]));
    await expect(
      service.reportUser('me', { targetUserId: 'me', reasonId: 'r1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an image path the reporter does not own', async () => {
    const { service } = setup(
      [[{ id: 'u2' }], [{ reason: 'Abuse' }]],
      Promise.resolve([]),
    );
    await expect(
      service.reportUser('me', {
        targetUserId: 'u2',
        reasonId: 'r1',
        imagePaths: ['report/u2/x.png'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('tells staff about the new account report', async () => {
    const { service, notifications } = setup(
      [[{ id: 'u2' }], [{ reason: 'Abuse' }]],
      Promise.resolve([{ id: 'rep2' }]),
    );

    await service.reportUser('me', { targetUserId: 'u2', reasonId: 'r1' });

    const [payload] = notifications.notifyStaff.mock.calls[0];
    expect(payload.type).toBe('report.created');
    expect(payload.title).toBe('New account report');
    expect(payload.body).toContain('Abuse');
    expect(payload.data).toEqual({
      reportId: 'rep2',
      targetType: 'user',
      targetId: 'u2',
      reason: 'Abuse',
    });
  });

  it('still files the account report when the staff notice fails', async () => {
    const { service, notifications } = setup(
      [[{ id: 'u2' }], [{ reason: 'Abuse' }]],
      Promise.resolve([{ id: 'rep2' }]),
    );
    notifications.notifyStaff.mockRejectedValue(new Error('db down'));

    await expect(
      service.reportUser('me', { targetUserId: 'u2', reasonId: 'r1' }),
    ).resolves.toEqual({ id: 'rep2' });
  });
});
