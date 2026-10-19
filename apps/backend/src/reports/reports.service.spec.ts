import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ReportSubmissionService } from './reports.service';
import type { CreateReportDto } from './dto/create-report.dto';

const REPORTER = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const REASON = '33333333-3333-4333-8333-333333333333';
const CREATED = new Date('2026-10-17T00:00:00Z');

type MockDb = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function makeDb(): MockDb {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

/** `.select().from().where().limit()` — every read in this service. */
function limitChain(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

/** Queues one result per `db.select()` call, in call order. */
function queueReads(db: MockDb, ...results: unknown[][]) {
  let call = 0;
  db.select.mockImplementation(() => limitChain(results[call++] ?? []));
}

function captureInsert(db: MockDb, row: { id: string; createdAt: Date }) {
  const sink: { values?: Record<string, unknown> } = {};
  db.insert.mockImplementation(() => ({
    values: (values: Record<string, unknown>) => ({
      returning: () => {
        sink.values = values;
        return Promise.resolve([row]);
      },
    }),
  }));
  return sink;
}

function dto(overrides: Partial<CreateReportDto> = {}): CreateReportDto {
  return {
    targetType: 'listing',
    targetId: TARGET,
    reasonId: REASON,
    ...overrides,
  };
}

describe('ReportSubmissionService', () => {
  let db: MockDb;
  let service: ReportSubmissionService;

  beforeEach(() => {
    db = makeDb();
    service = new ReportSubmissionService(db as never);
  });

  describe('create', () => {
    it('404s a missing listing target', async () => {
      queueReads(db, []);
      await expect(service.create(REPORTER, dto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404s a missing or soft-deleted user target', async () => {
      queueReads(db, []);
      await expect(
        service.create(REPORTER, dto({ targetType: 'user' })),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects reporting your own listing', async () => {
      queueReads(db, [{ id: TARGET, userId: REPORTER }]);
      await expect(service.create(REPORTER, dto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects reporting your own account', async () => {
      queueReads(db, [{ id: REPORTER }]);
      await expect(
        service.create(
          REPORTER,
          dto({ targetType: 'user', targetId: REPORTER }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a reason that does not exist for this target type', async () => {
      // The cross-type case is the same read: the WHERE pins target_type, so
      // a listing reason offered for a user report returns no row.
      queueReads(db, [{ id: TARGET, userId: TARGET }], []);
      await expect(service.create(REPORTER, dto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects evidence uploaded by another user', async () => {
      queueReads(db, [{ id: TARGET, userId: TARGET }], [{ id: REASON }]);
      await expect(
        service.create(
          REPORTER,
          dto({ imagePaths: ['report/other-user/proof.jpg'] }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a path-traversal segment in an evidence path', async () => {
      queueReads(db, [{ id: TARGET, userId: TARGET }], [{ id: REASON }]);
      await expect(
        service.create(
          REPORTER,
          dto({ imagePaths: [`report/${REPORTER}/../proof.jpg`] }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('409s a pending duplicate and never inserts', async () => {
      queueReads(
        db,
        [{ id: TARGET, userId: TARGET }],
        [{ id: REASON }],
        [{ id: 'pending-id' }],
      );
      await expect(service.create(REPORTER, dto())).rejects.toThrow(
        ConflictException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('allows a new report once the previous one was rejected', async () => {
      // The duplicate lookup filters status='pending', so a rejected report
      // yields no row and the insert proceeds.
      queueReads(db, [{ id: TARGET, userId: TARGET }], [{ id: REASON }], []);
      const sink = captureInsert(db, { id: 'new-id', createdAt: CREATED });

      await expect(
        service.create(
          REPORTER,
          dto({
            description: '  scam  ',
            imagePaths: [`report/${REPORTER}/proof.jpg`],
          }),
        ),
      ).resolves.toEqual({
        id: 'new-id',
        targetType: 'listing',
        targetId: TARGET,
        status: 'pending',
        createdAt: CREATED,
      });

      expect(sink.values).toEqual({
        reporterId: REPORTER,
        listingId: TARGET,
        reasonId: REASON,
        description: 'scam',
        imagePaths: [`report/${REPORTER}/proof.jpg`],
      });
    });

    it('defaults imagePaths to [] and a blank description to null', async () => {
      queueReads(db, [{ id: TARGET, userId: TARGET }], [{ id: REASON }], []);
      const sink = captureInsert(db, { id: 'new-id', createdAt: CREATED });

      await service.create(REPORTER, dto({ description: '   ' }));

      expect(sink.values).toMatchObject({ description: null, imagePaths: [] });
    });

    it('inserts a user report against target_user_id', async () => {
      queueReads(db, [{ id: TARGET }], [{ id: REASON }], []);
      const sink = captureInsert(db, { id: 'new-id', createdAt: CREATED });

      await service.create(REPORTER, dto({ targetType: 'user' }));

      expect(sink.values).toMatchObject({
        reporterId: REPORTER,
        targetUserId: TARGET,
        reasonId: REASON,
      });
    });
  });

  describe('listReasons', () => {
    it('returns only active reasons for the requested type', async () => {
      let where: unknown;
      db.select.mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = (arg: unknown) => {
          where = arg;
          return chain;
        };
        chain.orderBy = () => Promise.resolve([{ id: REASON, reason: 'Spam' }]);
        return chain;
      });

      const rows = await service.listReasons('user');

      expect(rows).toEqual([{ id: REASON, reason: 'Spam' }]);
      const { sql } = new PgDialect().sqlToQuery(where as never);
      expect(sql).toContain('"is_active" = $');
      expect(sql).toContain('"target_type" = $');
    });
  });
});
