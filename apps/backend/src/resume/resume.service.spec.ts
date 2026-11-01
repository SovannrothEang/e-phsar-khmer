import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { resumeSkills } from '../db/schema/resume.schema';
import { ResumeService } from './resume.service';

/**
 * A query builder needs a dialect, not a connection: this client is never
 * dialled (every terminal call below is intercepted), it exists so a test can
 * call `toSQL()` on the *real* statement the service would run and pin its
 * clause shape — the pattern `reactions.service.spec.ts` uses for WHERE
 * clauses, taken one step further for an upsert whose conflict clause is the
 * whole point.
 */
const builder = drizzle(
  postgres('postgres://ci@127.0.0.1:1/none', {
    prepare: false,
    max: 1,
  }),
  { schema, casing: 'snake_case' },
);

type CompiledQuery = { toSQL: () => { sql: string; params: unknown[] } };

type MockDb = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  transaction: jest.Mock;
};

/** Awaitable value that also carries the compiled statement it stands for. */
function result<T>(
  value: T,
  query?: CompiledQuery,
): Promise<T> & {
  returning: () => unknown;
  toSQL?: () => { sql: string; params: unknown[] };
} {
  const p = Promise.resolve(value) as Promise<T> & {
    returning: () => unknown;
    toSQL?: () => { sql: string; params: unknown[] };
  };
  p.returning = () => p;
  if (query) p.toSQL = () => query.toSQL();
  return p;
}

/** Chainable, awaitable select stub — one shape covers every read here. */
function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = self;
  c.where = self;
  c.orderBy = self;
  c.limit = self;
  c.offset = self;
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

interface InsertSink {
  values?: Record<string, unknown>;
  /** The compiled statement of the last insert, for clause-level pinning. */
  query?: { sql: string; params: unknown[] };
}

/**
 * Insert stub over the real builder: it records the payload, is awaitable (the
 * service awaits the conflict-update chain directly in one place, and
 * `.returning()` in the others), and still compiles the full statement.
 */
function insertStub(
  rowsForTable: (table: unknown) => unknown[],
  sink: InsertSink,
) {
  return (table: unknown) => {
    // Drizzle builds in two phases: `insert()` yields a builder whose
    // `values()` returns a *new* base builder carrying the conflict clause.
    const real = builder.insert(table as never) as unknown as RealInsertBuilder;
    return {
      values: (v: unknown) => {
        sink.values = v as Record<string, unknown>;
        const base = real.values(v);
        const compile = () => base.toSQL();
        // Every terminal call still records the real clause, so `sink.query`
        // holds the statement the service would have run.
        const finish = () => {
          sink.query = compile();
          return result(rowsForTable(table), { toSQL: compile });
        };
        return {
          onConflictDoUpdate: (config: unknown) => {
            base.onConflictDoUpdate(config);
            return finish();
          },
          onConflictDoNothing: () => finish(),
          returning: (...args: unknown[]) => {
            base.returning(...args);
            return finish();
          },
          toSQL: compile,
        };
      },
    };
  };
}

interface RealInsertBuilder {
  values: (v: unknown) => RealInsertBase;
}

interface RealInsertBase {
  onConflictDoUpdate: (config: unknown) => unknown;
  returning: (...args: unknown[]) => unknown;
  toSQL: () => { sql: string; params: unknown[] };
}

function updateStub(sink: { set?: unknown; where?: unknown }, rows: unknown[]) {
  return {
    set: (values: unknown) => {
      sink.set = values;
      return {
        where: (arg: unknown) => {
          sink.where = arg;
          return result(rows);
        },
      };
    },
  };
}

function deleteStub(sink: { where?: unknown }, rows: unknown[] = []) {
  return {
    where: (arg: unknown) => {
      sink.where = arg;
      return result(rows);
    },
  };
}

function makeService() {
  const db: MockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };
  const files = { removeByPublicUrl: jest.fn(() => Promise.resolve()) };
  const service = new ResumeService(db as never, files as never);
  return { service, db, files };
}

const dialect = new PgDialect();

function compile(part: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(part as never);
}

const personalRow = (over: Record<string, unknown> = {}) => ({
  resumeId: 'r1',
  firstName: 'Dara',
  lastName: 'Sok',
  gender: null,
  dob: null,
  nationality: null,
  email: null,
  educationLevel: null,
  maritalStatus: null,
  provinceId: null,
  districtId: null,
  communeId: null,
  address: null,
  position: null,
  yearsOfExperience: null,
  phones: ['012345678'],
  photoUrl: null,
  updatedAt: new Date(),
  ...over,
});

const experienceRow = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  resumeId: 'r1',
  company: 'ACME',
  position: 'Engineer',
  provinceId: null,
  districtId: null,
  communeId: null,
  startDate: '2021-01-01',
  endDate: null,
  isCurrent: true,
  description: '',
  createdAt: new Date(),
  ...over,
});

const experienceDto = (over: Record<string, unknown> = {}) => ({
  company: 'ACME',
  position: 'Engineer',
  startDate: '2021-01-01',
  endDate: null as string | null,
  current: true,
  ...over,
});

describe('ResumeService.getOrCreateResumeId', () => {
  it('compiles to an upsert on user_id — never `do nothing`', async () => {
    const { service, db } = makeService();
    const sink: InsertSink = {};
    db.insert.mockImplementation(insertStub(() => [{ id: 'r1' }], sink));

    await expect(service.getOrCreateResumeId('u1')).resolves.toBe('r1');

    expect(sink.values).toEqual({ userId: 'u1' });
    expect(sink.query?.sql).toContain('on conflict ("user_id") do update set');
    expect(sink.query?.sql).not.toContain('do nothing');
    // The no-op update must not restamp the document's own timestamp.
    expect(sink.query?.sql).toContain('"updated_at" = "resumes"."updated_at"');
  });
});

describe('ResumeService.upsertSkill', () => {
  it('scopes the conflict update to the caller’s own resume', async () => {
    const { service, db } = makeService();
    const resumeSink: InsertSink = {};
    const childSink: InsertSink = {};
    db.insert.mockImplementation((table: unknown) =>
      table === schema.resumes
        ? insertStub(() => [{ id: 'r1' }], resumeSink)(table)
        : insertStub(
            () => [
              { id: 's1', resumeId: 'r1', title: 'React', level: 'Expert' },
            ],
            childSink,
          )(table),
    );

    const skill = await service.upsertSkill('u1', 's1', {
      title: 'React',
      level: 'Expert',
    });

    expect(skill).toEqual({ id: 's1', title: 'React', level: 'Expert' });
    expect(childSink.query?.sql).toContain('on conflict ("id") do update set');
    expect(childSink.query?.sql).toContain('where "resume_skills"."resume_id"');
    expect(childSink.query?.params).toContain('r1');
  });

  it('404s when the id belongs to another resume (zero rows written)', async () => {
    const { service, db } = makeService();
    db.insert
      .mockReturnValueOnce(insertStub(() => [{ id: 'r1' }], {})(schema.resumes))
      .mockReturnValueOnce(insertStub(() => [], {})(resumeSkills));

    await expect(
      service.upsertSkill('u1', 'foreign', { title: 'x', level: 'y' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ResumeService date rules', () => {
  it('rejects an end date before the start date', async () => {
    const { service, db } = makeService();

    const err = await service
      .upsertExperience(
        'u1',
        'e1',
        experienceDto({
          startDate: '2024-01-01',
          endDate: '2023-01-01',
          current: false,
        }),
      )
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'RESUME_DATE_ORDER',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects a finished entry with no end date', async () => {
    const { service, db } = makeService();

    const err = await service
      .upsertExperience('u1', 'e1', experienceDto({ current: false }))
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'RESUME_END_DATE_REQUIRED',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('coerces a stale end date to null when the entry is current', async () => {
    const { service, db } = makeService();
    const childSink: InsertSink = {};
    db.insert.mockImplementation((table: unknown) =>
      table === schema.resumes
        ? insertStub(() => [{ id: 'r1' }], {})(table)
        : insertStub(() => [experienceRow()], childSink)(table),
    );

    await service.upsertExperience(
      'u1',
      'e1',
      experienceDto({ current: true, endDate: '2020-01-01' }),
    );

    expect(childSink.values).toMatchObject({ endDate: null, isCurrent: true });
  });
});

describe('ResumeService location coherence', () => {
  it('rejects a district without its province', async () => {
    const { service, db } = makeService();

    await expect(
      service.upsertExperience('u1', 'e1', experienceDto({ districtId: 'd1' })),
    ).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects a commune without its district', async () => {
    const { service } = makeService();

    const err = await service
      .savePersonal('u1', {
        firstName: 'Dara',
        lastName: 'Sok',
        phones: ['012345678'],
        provinceId: 'p1',
        communeId: 'c1',
      })
      .catch((e: unknown) => e);

    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'RESUME_LOCATION_INCOHERENT',
    });
  });
});

describe('ResumeService.getDocument', () => {
  it('returns `exists: false` and empty sections without a resume row — and writes nothing', async () => {
    const { service, db } = makeService();
    // Only the root read happens; no child query is issued at all.
    db.select.mockReturnValueOnce(chain([]));

    const document = await service.getDocument('u1');

    expect(document).toEqual({
      exists: false,
      personal: null,
      summary: '',
      hobbies: '',
      experiences: [],
      educations: [],
      skills: [],
      languages: [],
      references: [],
      jobPreference: null,
      attachment: null,
    });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('assembles every section and hydrates `place` from one lookup per level', async () => {
    const { service, db } = makeService();
    const geographyWheres: unknown[] = [];
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      switch (call) {
        case 1:
          return chain([{ id: 'r1', summary: 'Hello', hobbies: 'Chess' }]);
        case 2:
          return chain([personalRow({ provinceId: 'prov-1' })]);
        case 3:
          return chain([
            experienceRow({ provinceId: 'prov-1', districtId: 'dist-1' }),
          ]);
        case 4:
          return chain([
            {
              id: 'ed1',
              resumeId: 'r1',
              school: 'RUPP',
              degree: "Bachelor's Degree",
              major: 'CS',
              provinceId: null,
              districtId: null,
              communeId: 'com-1',
              startDate: '2016-01-01',
              endDate: '2020-01-01',
              isCurrent: false,
              description: '',
              createdAt: new Date(),
            },
          ]);
        case 5:
          return chain([{ id: 's1', title: 'React', level: 'Expert' }]);
        case 6:
          return chain([{ id: 'l1', title: 'Khmer', level: 'Native' }]);
        case 7:
          return chain([
            {
              id: 'ref1',
              name: 'Sokha',
              company: 'ACME',
              position: 'CTO',
              phones: ['012345678'],
              email: null,
            },
          ]);
        case 8:
          return chain([
            {
              resumeId: 'r1',
              openJob: true,
              position: 'Engineer',
              categories: ['IT'],
              locations: ['Phnom Penh'],
              jobTypes: ['Full-time'],
            },
          ]);
        case 9:
          return chain([
            {
              id: 'a1',
              fileName: 'cv.pdf',
              actualSize: 4321,
              uploadedAt: new Date('2026-10-15T00:00:00Z'),
              createdAt: new Date('2026-10-15T00:00:00Z'),
              status: 'attached',
            },
          ]);
        case 10:
          // One province id is shared by two rows — asked for once.
          return capturingChain(
            [{ id: 'prov-1', name: 'Phnom Penh', slug: 'phnom-penh' }],
            geographyWheres,
          );
        case 11:
          return capturingChain(
            [{ id: 'dist-1', name: 'Khan Daun Penh', slug: 'khan-daun-penh' }],
            geographyWheres,
          );
        default:
          return capturingChain(
            [{ id: 'com-1', name: 'Wat Phnom', slug: 'wat-phnom' }],
            geographyWheres,
          );
      }
    });

    const document = await service.getDocument('u1');

    expect(document.exists).toBe(true);
    expect(document.summary).toBe('Hello');
    expect(document.hobbies).toBe('Chess');
    expect(document.personal?.place.province).toEqual({
      id: 'prov-1',
      name: 'Phnom Penh',
      slug: 'phnom-penh',
    });
    expect(document.experiences[0].place.district?.id).toBe('dist-1');
    expect(document.educations[0].place.commune?.id).toBe('com-1');
    expect(document.educations[0].current).toBe(false);
    expect(document.skills).toEqual([
      { id: 's1', title: 'React', level: 'Expert' },
    ]);
    expect(document.jobPreference).toMatchObject({
      openJob: true,
      category: ['IT'],
      jobType: ['Full-time'],
    });
    expect(document.attachment).toEqual({
      id: 'a1',
      fileName: 'cv.pdf',
      size: 4321,
      uploadedAt: '2026-10-15T00:00:00.000Z',
    });

    // Three lookups total, and the shared province id is deduplicated.
    expect(geographyWheres).toHaveLength(3);
    expect(compile(geographyWheres[0]).params).toEqual(['prov-1']);
    expect(compile(geographyWheres[1]).params).toEqual(['dist-1']);
    expect(compile(geographyWheres[2]).params).toEqual(['com-1']);
  });
});

describe('ResumeService delete', () => {
  it('scopes the DELETE and resolves `deleted: true` even when nothing matched', async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(chain([{ id: 'r1' }]));
    const sink: { where?: unknown } = {};
    db.delete.mockReturnValue(deleteStub(sink));

    await expect(service.deleteSkill('u1', 's1')).resolves.toEqual({
      id: 's1',
      deleted: true,
    });

    const compiled = compile(sink.where);
    expect(compiled.sql).toContain('"resume_skills"."id" =');
    expect(compiled.sql).toContain('"resume_skills"."resume_id" =');
    expect(compiled.params).toEqual(['s1', 'r1']);
  });

  it('never touches the table when the caller has no resume at all', async () => {
    const { service, db } = makeService();
    db.select.mockReturnValueOnce(chain([]));

    await expect(service.deleteExperience('u1', 'e1')).resolves.toEqual({
      id: 'e1',
      deleted: true,
    });
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe('ResumeService.savePersonal', () => {
  it('removes the replaced photo only after the write, and only when it changed', async () => {
    const { service, db, files } = makeService();
    const order: string[] = [];
    files.removeByPublicUrl.mockImplementation(() => {
      order.push('remove');
      return Promise.resolve();
    });
    db.select.mockReturnValueOnce(chain([{ photoUrl: 'https://cdn/old.png' }]));
    db.insert.mockImplementation((table: unknown) => {
      if (table === schema.resumes)
        return insertStub(() => [{ id: 'r1' }], {})(table);
      // The rows are read when the write is awaited, so this records the
      // moment the personal row is written.
      return insertStub(() => {
        order.push('write');
        return [personalRow({ photoUrl: 'https://cdn/new.png' })];
      }, {})(table);
    });

    await service.savePersonal('u1', {
      firstName: 'Dara',
      lastName: 'Sok',
      phones: ['012345678'],
      photoUrl: 'https://cdn/new.png',
    });

    expect(files.removeByPublicUrl).toHaveBeenCalledWith('https://cdn/old.png');
    expect(order).toEqual(['write', 'remove']);
  });

  it('leaves storage alone when the photo did not change', async () => {
    const { service, db, files } = makeService();
    db.select.mockReturnValueOnce(chain([{ photoUrl: null }]));
    db.insert.mockImplementation((table: unknown) =>
      insertStub(
        () => [personalRow({ photoUrl: 'https://cdn/same.png' })],
        {},
      )(table),
    );

    await service.savePersonal('u1', {
      firstName: 'Dara',
      lastName: 'Sok',
      phones: ['012345678'],
      photoUrl: 'https://cdn/same.png',
    });

    expect(files.removeByPublicUrl).not.toHaveBeenCalled();
  });
});

describe('ResumeService.updateDocument', () => {
  it('leaves every field alone when the patch omits them', async () => {
    const { service, db } = makeService();
    db.select
      .mockReturnValueOnce(chain([{ id: 'r1' }]))
      .mockReturnValueOnce(chain([{ summary: 'kept', hobbies: 'kept too' }]))
      .mockReturnValueOnce(chain([]));

    const document = await service.updateDocument('u1', {});

    expect(document).toEqual({
      summary: 'kept',
      hobbies: 'kept too',
      jobPreference: null,
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('clears the stored text with an explicit null', async () => {
    const { service, db } = makeService();
    const sink: { set?: unknown } = {};
    db.select
      .mockReturnValueOnce(chain([{ id: 'r1' }]))
      .mockReturnValueOnce(chain([{ summary: '', hobbies: 'kept' }]))
      .mockReturnValueOnce(chain([]));
    db.update.mockReturnValue(updateStub(sink, []));

    await service.updateDocument('u1', { summary: null });

    expect(sink.set).toEqual({ summary: '' });
  });

  it('deletes the preference row on an explicit null', async () => {
    const { service, db } = makeService();
    const sink: { where?: unknown } = {};
    db.select
      .mockReturnValueOnce(chain([{ id: 'r1' }]))
      .mockReturnValueOnce(chain([{ summary: '', hobbies: '' }]))
      .mockReturnValueOnce(chain([]));
    db.delete.mockReturnValue(deleteStub(sink));

    await service.updateDocument('u1', { jobPreferences: null });

    expect(compile(sink.where).params).toEqual(['r1']);
  });

  it('upserts the preference row as an object', async () => {
    const { service, db } = makeService();
    const sink: InsertSink = {};
    const preference = {
      resumeId: 'r1',
      openJob: true,
      position: 'Engineer',
      categories: ['IT'],
      locations: [],
      jobTypes: [],
    };
    db.select
      .mockReturnValueOnce(chain([{ id: 'r1' }]))
      .mockReturnValueOnce(chain([{ summary: '', hobbies: '' }]))
      .mockReturnValueOnce(chain([preference]));
    db.insert.mockImplementation(insertStub(() => [preference], sink));

    const updated = await service.updateDocument('u1', {
      jobPreferences: {
        openJob: true,
        position: 'Engineer',
        category: ['IT'],
        location: [],
        jobType: [],
      },
    });

    expect(sink.values).toMatchObject({ resumeId: 'r1', categories: ['IT'] });
    expect(sink.query?.sql).toContain(
      'on conflict ("resume_id") do update set',
    );
    expect(updated.jobPreference).toMatchObject({ openJob: true });
  });
});
