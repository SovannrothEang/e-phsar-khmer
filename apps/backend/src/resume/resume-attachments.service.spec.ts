import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ResumeAttachmentsService } from './resume-attachments.service';
import {
  RESUME_ATTACHMENT_MAX_BYTES,
  RESUME_ATTACHMENT_ORPHAN_AGE_HOURS,
  RESUME_ATTACHMENT_PENDING_MAX,
} from './resume-attachments.constants';

/** Chainable, awaitable select stub — covers every read in this service. */
function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = self;
  c.where = self;
  c.orderBy = self;
  c.limit = self;
  c.then = (resolve: (value: unknown[]) => unknown) =>
    Promise.resolve(rows).then(resolve);
  return c;
}

/** `chain`, but recording every `where` argument so a test can compile it. */
function capturingChain(rows: unknown[], sink: unknown[]) {
  const c = chain(rows);
  c.where = (arg: unknown) => {
    sink.push(arg);
    return c;
  };
  return c;
}

/** `.from().where().limit()` → rows */
function limitQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

/** `.values(…).onConflictDoNothing()/.onConflictDoUpdate()….returning()` */
function insertStub(rows: unknown[], sink: { values?: unknown } = {}) {
  return {
    values: (v: unknown) => {
      sink.values = v;
      const base = { returning: () => Promise.resolve(rows) };
      return {
        onConflictDoNothing: () => base,
        onConflictDoUpdate: () => base,
      };
    },
  };
}

/** `.set(…).where(…)` → awaitable, and `.returning()` for the tx paths. */
function updateStub(sink: { set?: unknown; where?: unknown }, rows: unknown[]) {
  return {
    set: (values: unknown) => {
      sink.set = values;
      return {
        where: (arg: unknown) => {
          sink.where = arg;
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

/** `delete(…).where(…)` → `.returning()` — the tx swap and `deleteAttachment`. */
function deleteReturningStub(sink: { where?: unknown }, rows: unknown[]) {
  return {
    where: (arg: unknown) => {
      sink.where = arg;
      return { returning: () => Promise.resolve(rows) };
    },
  };
}

function makeService() {
  const db = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
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
    createSignedUrl: jest.fn(),
  };
  const config = { get: jest.fn(() => 'resume-files') };
  const service = new ResumeAttachmentsService(
    db as never,
    supabase as never,
    config as never,
  );
  return { service, db, supabase };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  userId: 'u1',
  resumeId: null,
  objectKey: 'u1/a1/cv.pdf',
  fileName: 'cv.pdf',
  status: 'pending',
  declaredSize: 1000,
  actualSize: null,
  createdAt: new Date(),
  uploadedAt: null,
  attachedAt: null,
  ...over,
});

/**
 * The `complete` happy path's surroundings: an object of `size` in storage, the
 * resume anchor upserted, and a transaction whose UPDATE attaches the row.
 */
function wireComplete(
  deps: ReturnType<typeof makeService>,
  options: {
    size?: number;
    existing?: Record<string, unknown>;
    replaced?: unknown[];
    attachWrites?: unknown[];
  } = {},
) {
  const { service, db, supabase } = deps;
  db.select.mockReturnValueOnce(
    limitQuery([options.existing ?? row({ status: 'pending' })]),
  );
  supabase.objectInfo.mockResolvedValueOnce({
    data: { size: options.size ?? 4321 },
    error: null,
  });
  db.insert.mockReturnValueOnce(insertStub([{ id: 'r1' }]));
  const update = { set: undefined, where: undefined } as {
    set?: unknown;
    where?: unknown;
  };
  const del = { where: undefined } as { where?: unknown };
  const tx = {
    update: () => updateStub(update, options.attachWrites ?? [{ id: 'a1' }]),
    delete: () => deleteReturningStub(del, options.replaced ?? []),
  };
  db.transaction.mockImplementation((cb: (t: unknown) => unknown) =>
    Promise.resolve(cb(tx)),
  );
  return { service, db, supabase, update, del };
}

describe('ResumeAttachmentsService.create', () => {
  it('rejects a file above the cap before anything is reserved', async () => {
    const { service, db } = makeService();

    const err = await service
      .create('u1', {
        id: 'a1',
        fileName: 'cv.pdf',
        declaredSize: RESUME_ATTACHMENT_MAX_BYTES + 1,
      })
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'RESUME_ATTACHMENT_TOO_LARGE',
    });
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it(`429s at ${RESUME_ATTACHMENT_PENDING_MAX} outstanding pending uploads`, async () => {
    const { service, db } = makeService();
    db.select
      .mockReturnValueOnce(limitQuery([])) // no row for this id
      .mockReturnValueOnce(
        limitQuery(
          Array.from({ length: RESUME_ATTACHMENT_PENDING_MAX }, (_, i) => ({
            id: `p${i}`,
          })),
        ),
      );

    const err = await service
      .create('u1', { id: 'a1', fileName: 'cv.pdf', declaredSize: 1000 })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('namespaces the object per user and returns a signed upload URL', async () => {
    const { service, db, supabase } = makeService();
    const sink: { values?: unknown } = {};
    db.select
      .mockReturnValueOnce(limitQuery([]))
      .mockReturnValueOnce(limitQuery([]));
    // What Postgres hands back for those values.
    db.insert.mockReturnValueOnce(
      insertStub(
        [
          row({
            objectKey: 'u1/a1/My_CV_2026.pdf',
            fileName: 'My CV 2026.pdf',
          }),
        ],
        sink,
      ),
    );

    const ticket = await service.create('u1', {
      id: 'a1',
      fileName: 'My CV 2026.pdf',
      declaredSize: 1000,
    });

    expect(sink.values).toMatchObject({
      objectKey: 'u1/a1/My_CV_2026.pdf',
      fileName: 'My CV 2026.pdf',
      userId: 'u1',
      declaredSize: 1000,
    });
    expect(supabase.createSignedUploadUrl).toHaveBeenCalledWith(
      'resume-files',
      'u1/a1/My_CV_2026.pdf',
      { upsert: true },
    );
    expect(ticket).toMatchObject({ id: 'a1', uploadUrl: 'https://up' });
  });

  it('is idempotent: a retry of a pending upload re-issues its URL', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ status: 'pending' })]));

    const ticket = await service.create('u1', {
      id: 'a1',
      fileName: 'cv.pdf',
      declaredSize: 1000,
    });

    expect(ticket.id).toBe('a1');
    expect(db.insert).not.toHaveBeenCalled();
    expect(supabase.createSignedUploadUrl).toHaveBeenCalledWith(
      'resume-files',
      'u1/a1/cv.pdf',
      { upsert: true },
    );
  });

  it("409s when the id belongs to another user's attachment", async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ userId: 'u9' })]));

    const err = await service
      .create('u1', { id: 'a1', fileName: 'cv.pdf', declaredSize: 1000 })
      .catch((e: unknown) => e);

    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'RESUME_ATTACHMENT_ID_TAKEN',
    });
  });

  it('409s when that id is no longer pending', async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(
      limitQuery([row({ status: 'attached', resumeId: 'r1' })]),
    );

    const err = await service
      .create('u1', { id: 'a1', fileName: 'cv.pdf', declaredSize: 1000 })
      .catch((e: unknown) => e);

    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'RESUME_ATTACHMENT_NOT_PENDING',
    });
  });
});

describe('ResumeAttachmentsService.complete', () => {
  it('404s for an attachment the caller did not upload', async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ userId: 'u9' })]));

    await expect(service.complete('u1', 'a1')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('409s RESUME_ATTACHMENT_NOT_UPLOADED when the object is missing', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row()]));
    supabase.objectInfo.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });

    const err = await service.complete('u1', 'a1').catch((e: unknown) => e);

    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'RESUME_ATTACHMENT_NOT_UPLOADED',
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('409s an expired row', async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ status: 'expired' })]));

    const err = await service.complete('u1', 'a1').catch((e: unknown) => e);

    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'RESUME_ATTACHMENT_EXPIRED',
    });
  });

  it('trusts storage over the client: an oversized object is deleted and expired', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(limitQuery([row({ declaredSize: 1000 })]));
    supabase.objectInfo.mockResolvedValueOnce({
      data: { size: RESUME_ATTACHMENT_MAX_BYTES + 1 },
      error: null,
    });
    const sink: { set?: unknown } = {};
    db.update.mockReturnValueOnce(updateStub(sink, []));

    await expect(service.complete('u1', 'a1')).rejects.toThrow(
      BadRequestException,
    );

    expect(supabase.removeObjects).toHaveBeenCalledWith('resume-files', [
      'u1/a1/cv.pdf',
    ]);
    expect(sink.set).toMatchObject({
      status: 'expired',
      actualSize: RESUME_ATTACHMENT_MAX_BYTES + 1,
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('attaches with the size read from storage, not the declared one', async () => {
    const { service, db, supabase, update } = wireComplete(makeService(), {
      size: 4321,
      existing: row({ declaredSize: 999 }),
    });

    await expect(service.complete('u1', 'a1')).resolves.toEqual({
      id: 'a1',
      status: 'attached',
      size: 4321,
    });

    expect(update.set).toMatchObject({
      status: 'attached',
      resumeId: 'r1',
      actualSize: 4321,
    });
    // One conditional UPDATE inside one transaction is what makes a repeated
    // complete safe.
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(supabase.removeObjects).not.toHaveBeenCalled();
  });

  it('replaces the previous CV: the old row is gone and its object removed', async () => {
    const { service, supabase, del } = wireComplete(makeService(), {
      size: 4321,
      replaced: [{ objectKey: 'u1/a0/old.docx' }],
    });

    await expect(service.complete('u1', 'a1')).resolves.toMatchObject({
      status: 'attached',
      size: 4321,
    });

    expect(supabase.removeObjects).toHaveBeenCalledWith('resume-files', [
      'u1/a0/old.docx',
    ]);
    const compiled = new PgDialect().sqlToQuery(del.where as never);
    expect(compiled.sql).toContain('"resume_attachments"."resume_id" =');
    expect(compiled.sql).toContain('"resume_attachments"."id" <>');
    expect(compiled.params).toEqual(['r1', 'a1']);
  });

  it('a concurrent double-complete falls back to the stored row', async () => {
    const { service, db, supabase } = makeService();
    db.select
      .mockReturnValueOnce(limitQuery([row({ status: 'pending' })]))
      // The fallback re-read: the other request already attached it.
      .mockReturnValueOnce(
        limitQuery([
          row({ status: 'attached', resumeId: 'r1', actualSize: 2222 }),
        ]),
      );
    supabase.objectInfo.mockResolvedValueOnce({
      data: { size: 4321 },
      error: null,
    });
    db.insert.mockReturnValueOnce(insertStub([{ id: 'r1' }]));
    const del: { where?: unknown } = {};
    const tx = {
      update: () => updateStub({ set: {} }, []),
      delete: () => deleteReturningStub(del, [{ objectKey: 'someone-elses' }]),
    };
    db.transaction.mockImplementation((cb: (t: unknown) => unknown) =>
      Promise.resolve(cb(tx)),
    );

    await expect(service.complete('u1', 'a1')).resolves.toEqual({
      id: 'a1',
      status: 'attached',
      size: 2222,
    });
    // The losing request replaced nothing.
    expect(del.where).toBeUndefined();
    expect(supabase.removeObjects).not.toHaveBeenCalled();
  });

  it('is idempotent once attached — the stored size comes back untouched', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(
      limitQuery([row({ status: 'attached', actualSize: 4321 })]),
    );

    await expect(service.complete('u1', 'a1')).resolves.toEqual({
      id: 'a1',
      status: 'attached',
      size: 4321,
    });

    expect(supabase.objectInfo).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe('ResumeAttachmentsService.sign', () => {
  it('returns nothing — and signs nothing — when there is no attached CV', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(chain([]));

    await expect(service.sign('u1')).resolves.toEqual([]);
    expect(supabase.createSignedUrl).not.toHaveBeenCalled();
  });

  it('scopes the read to the caller and asks for a 5-minute URL', async () => {
    const { service, db, supabase } = makeService();
    const wheres: unknown[] = [];
    db.select.mockReturnValueOnce(
      capturingChain([{ objectKey: 'u1/a1/cv.pdf' }], wheres),
    );
    supabase.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://signed' },
      error: null,
    });

    const urls = await service.sign('u1');

    expect(supabase.createSignedUrl).toHaveBeenCalledWith(
      'resume-files',
      'u1/a1/cv.pdf',
      300,
    );
    expect(urls).toHaveLength(1);
    expect(urls[0].url).toBe('https://signed');
    expect(new Date(urls[0].expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 4 * 60 * 1000,
    );
    const compiled = new PgDialect().sqlToQuery(wheres[0] as never);
    expect(compiled.sql).toContain('"resume_attachments"."user_id" =');
    expect(compiled.sql).toContain('"resume_attachments"."status" =');
    expect(compiled.params).toEqual(['u1', 'attached']);
  });

  it('surfaces a storage failure as a 502', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(chain([{ objectKey: 'u1/a1/cv.pdf' }]));
    supabase.createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    const err = await service.sign('u1').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(502);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'RESUME_ATTACHMENT_SIGN_FAILED',
    });
  });
});

describe('ResumeAttachmentsService.deleteAttachment', () => {
  it("removes the caller's attached row and hands its object to storage", async () => {
    const { service, db, supabase } = makeService();
    const sink: { where?: unknown } = {};
    db.delete.mockReturnValueOnce(
      deleteReturningStub(sink, [{ objectKey: 'u1/a1/cv.pdf' }]),
    );

    await expect(service.deleteAttachment('u1')).resolves.toEqual({
      deleted: true,
    });

    expect(supabase.removeObjects).toHaveBeenCalledWith('resume-files', [
      'u1/a1/cv.pdf',
    ]);
    const compiled = new PgDialect().sqlToQuery(sink.where as never);
    expect(compiled.sql).toContain('"resume_attachments"."user_id" =');
    expect(compiled.sql).toContain('"resume_attachments"."status" =');
    expect(compiled.params).toEqual(['u1', 'attached']);
  });

  it('is idempotent — nothing to delete still resolves and touches no object', async () => {
    const { service, db, supabase } = makeService();
    db.delete.mockReturnValueOnce(deleteReturningStub({}, []));

    await expect(service.deleteAttachment('u1')).resolves.toEqual({
      deleted: true,
    });
    expect(supabase.removeObjects).not.toHaveBeenCalled();
  });
});

describe('ResumeAttachmentsService.cleanupOrphans', () => {
  const orphans = [
    { id: 'a1', objectKey: 'u1/a1/cv.pdf' },
    { id: 'a2', objectKey: 'u2/a2/cv.docx' },
  ];

  it('targets only never-attached rows past the age window, objects first', async () => {
    const { service, db, supabase } = makeService();
    const wheres: unknown[] = [];
    db.select.mockReturnValueOnce(capturingChain(orphans, wheres));
    const where = jest.fn(() => Promise.resolve(undefined));
    db.delete.mockReturnValueOnce({ where });

    await expect(service.cleanupOrphans()).resolves.toBe(2);

    const compiled = new PgDialect().sqlToQuery(wheres[0] as never);
    expect(compiled.sql).toContain('"resume_attachments"."resume_id" is null');
    expect(compiled.sql).toContain('make_interval(hours =>');
    expect(compiled.params).toContain(RESUME_ATTACHMENT_ORPHAN_AGE_HOURS);
    expect(supabase.removeObjects).toHaveBeenCalledWith('resume-files', [
      'u1/a1/cv.pdf',
      'u2/a2/cv.docx',
    ]);
    expect(where).toHaveBeenCalled();
  });

  it('keeps the rows when storage refuses, so the next run retries', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(chain(orphans));
    supabase.removeObjects.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    } as never);

    await expect(service.cleanupOrphans()).resolves.toBe(0);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('does nothing when there are no orphans', async () => {
    const { service, db, supabase } = makeService();
    db.select.mockReturnValueOnce(chain([]));

    await expect(service.cleanupOrphans()).resolves.toBe(0);
    expect(supabase.removeObjects).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });
});
