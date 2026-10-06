import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ChatAttachmentsService } from './chat-attachments.service';
import { ATTACHMENT_MAX_BYTES } from './chat-attachments.constants';

const MB = 1024 * 1024;

// .from().where().limit() → rows
function limitQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

// .from().where() → rows (quota sum)
function whereQuery(rows: unknown[]) {
  return { from: () => ({ where: () => Promise.resolve(rows) }) };
}

// .set().where().returning() → rows, capturing what was set
function updateReturning(rows: unknown[], sets: unknown[] = []) {
  return {
    set: (v: unknown) => {
      sets.push(v);
      return {
        where: () => {
          const p = Promise.resolve(undefined) as Promise<undefined> & {
            returning: () => Promise<unknown[]>;
          };
          p.returning = () => Promise.resolve(rows);
          return p;
        },
      };
    },
  };
}

function makeService(opts: { dailyBytes?: number } = {}) {
  const db = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const supabase = {
    createSignedUploadUrl: jest.fn(() =>
      Promise.resolve({
        data: { signedUrl: 'https://up', token: 't', path: 'p' },
        error: null,
      }),
    ),
    objectInfo: jest.fn(),
    removeObjects: jest.fn(() => Promise.resolve({ data: [], error: null })),
    createSignedUrls: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'chat.attachmentDailyBytes'
        ? (opts.dailyBytes ?? 200 * MB)
        : 'chat-files',
    ),
  };
  const service = new ChatAttachmentsService(
    db as never,
    supabase as never,
    config as never,
  );
  return { service, db, supabase };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  uploaderId: 'u1',
  messageId: null,
  objectKey: 'u1/a1',
  kind: 'image',
  status: 'pending',
  declaredSize: 1000,
  actualSize: null,
  ...over,
});

describe('ChatAttachmentsService.create', () => {
  it('rejects an image larger than the image limit', async () => {
    const { service, db } = makeService();

    const err = await service
      .create('u1', {
        id: 'a1',
        kind: 'image',
        declaredSize: ATTACHMENT_MAX_BYTES.image + 1,
      })
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'ATTACHMENT_TOO_LARGE',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('429s when the daily quota would be exceeded', async () => {
    const { service, db } = makeService({ dailyBytes: 10 * MB });
    db.select
      .mockReturnValueOnce(limitQuery([])) // no existing row
      .mockReturnValueOnce(whereQuery([{ used: 9.5 * MB }]));

    const err = await service
      .create('u1', { id: 'a1', kind: 'image', declaredSize: MB })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('stores a server-generated object key and returns an upload URL', async () => {
    const { service, db, supabase } = makeService();
    db.select
      .mockReturnValueOnce(limitQuery([]))
      .mockReturnValueOnce(whereQuery([{ used: 0 }]));
    const values: Record<string, unknown>[] = [];
    db.insert.mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        values.push(v);
        return {
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([row()]),
          }),
        };
      },
    });

    const res = await service.create('u1', {
      id: 'a1',
      kind: 'image',
      declaredSize: 1000,
    });

    expect(values[0]).toMatchObject({ objectKey: 'u1/a1', uploaderId: 'u1' });
    expect(supabase.createSignedUploadUrl).toHaveBeenCalledWith(
      'chat-files',
      'u1/a1',
      { upsert: true },
    );
    expect(res).toMatchObject({ id: 'a1', uploadUrl: 'https://up' });
  });

  it('is idempotent: a retry of a pending attachment re-issues its URL', async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row()]));

    const res = await service.create('u1', {
      id: 'a1',
      kind: 'image',
      declaredSize: 1000,
    });

    expect(res.id).toBe('a1');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("409s when the id belongs to another user's attachment", async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ uploaderId: 'u9' })]));

    const err = await service
      .create('u1', { id: 'a1', kind: 'image', declaredSize: 1000 })
      .catch((e: unknown) => e);

    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'ATTACHMENT_ID_TAKEN',
    });
  });
});

describe('ChatAttachmentsService.complete', () => {
  it('404s for an attachment the caller did not upload', async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ uploaderId: 'u9' })]));

    await expect(service.complete('u1', 'a1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('409s ATTACHMENT_NOT_UPLOADED when the object is missing', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row()]));
    supabase.objectInfo.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });

    const err = await service.complete('u1', 'a1').catch((e: unknown) => e);

    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'ATTACHMENT_NOT_UPLOADED',
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('deletes an oversized object and marks it expired, trusting only the real size', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ declaredSize: 1000 })]));
    supabase.objectInfo.mockResolvedValueOnce({
      data: { size: ATTACHMENT_MAX_BYTES.image + 1 },
      error: null,
    });
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValueOnce(updateReturning([], sets));

    await expect(service.complete('u1', 'a1')).rejects.toThrow(
      BadRequestException,
    );
    expect(supabase.removeObjects).toHaveBeenCalledWith('chat-files', [
      'u1/a1',
    ]);
    expect(sets[0]).toMatchObject({ status: 'expired' });
  });

  it('marks the attachment uploaded with the size read from storage', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row()]));
    supabase.objectInfo.mockResolvedValueOnce({
      data: { size: 4321 },
      error: null,
    });
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValueOnce(
      updateReturning([{ actualSize: 4321 }], sets),
    );

    await expect(service.complete('u1', 'a1')).resolves.toEqual({
      id: 'a1',
      status: 'uploaded',
      actualSize: 4321,
    });
    expect(sets[0]).toMatchObject({ status: 'uploaded', actualSize: 4321 });
  });

  it('is idempotent once uploaded', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(
      limitQuery([row({ status: 'uploaded', actualSize: 50 })]),
    );

    await expect(service.complete('u1', 'a1')).resolves.toMatchObject({
      actualSize: 50,
    });
    expect(supabase.objectInfo).not.toHaveBeenCalled();
  });
});

describe('ChatAttachmentsService.attachToMessage', () => {
  it('rejects with ATTACHMENT_INVALID listing the ids that did not attach', async () => {
    const { service } = makeService();
    const tx = {
      update: jest.fn(() => updateReturning([{ id: 'a1', kind: 'image' }])),
    };

    const err = await service
      .attachToMessage(tx as never, 'u1', 'm1', ['a1', 'a2'])
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'ATTACHMENT_INVALID',
      details: { invalid: ['a2'] },
    });
  });

  it("returns the attachments in the sender's order", async () => {
    const { service } = makeService();
    const sets: Record<string, unknown>[] = [];
    const tx = {
      update: jest.fn(() =>
        updateReturning(
          [
            { id: 'a2', kind: 'file' },
            { id: 'a1', kind: 'image' },
          ],
          sets,
        ),
      ),
    };

    await expect(
      service.attachToMessage(tx as never, 'u1', 'm1', ['a1', 'a2']),
    ).resolves.toEqual([
      { id: 'a1', kind: 'image' },
      { id: 'a2', kind: 'file' },
    ]);
    expect(sets[0]).toMatchObject({ status: 'attached', messageId: 'm1' });
  });

  it('does nothing for an empty list', async () => {
    const { service } = makeService();
    const tx = { update: jest.fn() };

    await expect(
      service.attachToMessage(tx as never, 'u1', 'm1', []),
    ).resolves.toEqual([]);
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe('ChatAttachmentsService.sign', () => {
  // .from().innerJoin().innerJoin().where() → rows
  const joinQuery = (rows: unknown[]) => ({
    from: () => ({
      innerJoin: () => ({
        innerJoin: () => ({ where: () => Promise.resolve(rows) }),
      }),
    }),
  });

  it('returns nothing (and signs nothing) when no id qualifies', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(joinQuery([]));

    await expect(service.sign('u1', ['a1'])).resolves.toEqual([]);
    expect(supabase.createSignedUrls).not.toHaveBeenCalled();
  });

  it('signs qualifying attachments in one storage call', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(
      joinQuery([
        { id: 'a1', objectKey: 'u2/a1' },
        { id: 'a2', objectKey: 'u2/a2' },
      ]),
    );
    supabase.createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'u2/a1', signedUrl: 'https://s/1' },
        { path: 'u2/a2', signedUrl: null },
      ],
      error: null,
    });

    const res = await service.sign('u1', ['a1', 'a2', 'foreign']);

    expect(supabase.createSignedUrls).toHaveBeenCalledWith(
      'chat-files',
      ['u2/a1', 'u2/a2'],
      300,
    );
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ id: 'a1', url: 'https://s/1' });
  });
});

describe('ChatAttachmentsService.cleanupOrphans', () => {
  // .from().where().limit() → rows
  const orphans = [
    { id: 'a1', objectKey: 'u1/a1' },
    { id: 'a2', objectKey: 'u1/a2' },
  ];

  it('removes objects then rows', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery(orphans));
    const where = jest.fn(() => Promise.resolve(undefined));
    db.delete.mockReturnValueOnce({ where });

    await expect(service.cleanupOrphans()).resolves.toBe(2);
    expect(supabase.removeObjects).toHaveBeenCalledWith('chat-files', [
      'u1/a1',
      'u1/a2',
    ]);
    expect(where).toHaveBeenCalled();
  });

  it('keeps the rows when storage refuses, so the next run retries', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery(orphans));
    supabase.removeObjects.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    } as never);

    await expect(service.cleanupOrphans()).resolves.toBe(0);
    expect(db.delete).not.toHaveBeenCalled();
  });
});
