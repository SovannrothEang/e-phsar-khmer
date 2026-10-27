import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { DbClient } from '../db/drizzle.provider';
import { ProductsService } from './products.service';

const dialect = new PgDialect();

/** The select chain used by every joined product read. */
function selectChain(result: unknown[]) {
  const limit = jest.fn().mockResolvedValue(result);
  // `.orderBy()` is the end of `listAdmin`'s chain and the middle of
  // `listPublished`'s — real drizzle returns a thenable that also has
  // `.limit()`, so the mock must be both.
  const orderByResult = Object.assign(Promise.resolve(result), { limit });
  const orderBy = jest.fn(() => orderByResult);
  const where = jest.fn(() => ({ limit, orderBy }));
  const chain: Record<string, jest.Mock> = {
    from: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    where,
    orderBy,
    limit,
  };
  return { chain, where, orderBy, limit };
}

/** `.select().from().where().limit()` — the update existence probe. */
function simpleSelect(result: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(result) }) }),
  };
}

function makeDb() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeService(db: ReturnType<typeof makeDb>) {
  return new ProductsService(db as unknown as DbClient);
}

const summaryRow = {
  id: 'spec-1',
  modelId: 'm1',
  brandId: 'b1',
  brandSlug: 'apple',
  brandName: 'Apple',
  modelSlug: 'iphone-16',
  modelName: 'iPhone 16',
  image: null,
};

const detailRow = {
  ...summaryRow,
  specGroups: [{ title: 'Display', rows: [{ label: 'Size', value: '6.1"' }] }],
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProductsService public reads', () => {
  it('lists published products with the caller limit', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain, orderBy, limit } = selectChain([summaryRow]);
    db.select.mockReturnValue(chain);

    const rows = await service.listPublished({ limit: 6 });

    expect(rows).toEqual([summaryRow]);
    expect(orderBy).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(6);
  });

  it('searches every token across brand and model names/slugs', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain, where } = selectChain([]);
    db.select.mockReturnValue(chain);

    await service.listPublished({ q: 'iphone 18', limit: 5 });

    const compiled = dialect.sqlToQuery(where.mock.calls[0][0] as SQL);
    expect(compiled.sql).toContain('"is_published"');
    expect(compiled.sql).toContain('is_active');
    expect(compiled.sql.match(/ilike/gi)?.length).toBe(8);
    expect(compiled.params).toEqual(
      expect.arrayContaining(['%iphone%', '%18%']),
    );
  });

  it('escapes wildcard characters in the search term', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain, where } = selectChain([]);
    db.select.mockReturnValue(chain);

    await service.listPublished({ q: '100%', limit: 5 });

    const compiled = dialect.sqlToQuery(where.mock.calls[0][0] as SQL);
    expect(compiled.params).toContain('%100\\%%');
  });

  it('returns a published page by brand/model slug', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain } = selectChain([detailRow]);
    db.select.mockReturnValue(chain);

    await expect(
      service.getPublishedBySlug('apple', 'iphone-16'),
    ).resolves.toEqual(detailRow);
  });

  it('404s a missing or unpublished page', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain } = selectChain([]);
    db.select.mockReturnValue(chain);

    await expect(
      service.getPublishedBySlug('apple', 'nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists every spec page for the admin table', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain, orderBy } = selectChain([detailRow]);
    db.select.mockReturnValue(chain);

    await expect(service.listAdmin()).resolves.toEqual([detailRow]);
    expect(orderBy).toHaveBeenCalled();
  });
});

describe('ProductsService listing gate', () => {
  it('resolves when the model has a published page', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain } = selectChain([{ id: 'spec-1' }]);
    db.select.mockReturnValue(chain);

    await expect(service.assertPublishedModel('m1')).resolves.toBeUndefined();
  });

  it('rejects a model without a published page', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain } = selectChain([]);
    db.select.mockReturnValue(chain);

    await expect(service.assertPublishedModel('m1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps a published ref for the listing detail', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain } = selectChain([
      {
        modelId: 'm1',
        brandSlug: 'apple',
        brandName: 'Apple',
        modelSlug: 'iphone-16',
        modelName: 'iPhone 16',
      },
    ]);
    db.select.mockReturnValue(chain);

    await expect(service.getPublishedRefByModelId('m1')).resolves.toEqual({
      modelId: 'm1',
      brandSlug: 'apple',
      brandName: 'Apple',
      modelSlug: 'iphone-16',
      modelName: 'iPhone 16',
    });
  });

  it('returns null when the page is gone', async () => {
    const db = makeDb();
    const service = makeService(db);
    const { chain } = selectChain([]);
    db.select.mockReturnValue(chain);

    await expect(service.getPublishedRefByModelId('m1')).resolves.toBeNull();
  });
});

describe('ProductsService admin writes', () => {
  it('creates a spec page with trimmed groups and published by default', async () => {
    const db = makeDb();
    const service = makeService(db);
    const values = jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([{ id: 'spec-1' }]),
    }));
    db.insert.mockReturnValue({ values });
    const { chain } = selectChain([detailRow]);
    db.select.mockReturnValue(chain);

    await service.createAdmin({
      modelId: 'm1',
      specGroups: [
        {
          title: '  Display  ',
          rows: [{ label: ' Size ', value: ' 6.1" ' }],
        },
      ],
    });

    expect(values).toHaveBeenCalledWith({
      modelId: 'm1',
      specGroups: [
        { title: 'Display', rows: [{ label: 'Size', value: '6.1"' }] },
      ],
      isPublished: true,
    });
  });

  it('rejects empty spec text', async () => {
    const db = makeDb();
    const service = makeService(db);

    await expect(
      service.createAdmin({
        modelId: 'm1',
        specGroups: [
          { title: 'Display', rows: [{ label: ' ', value: '6.1"' }] },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('maps a duplicate model to 409', async () => {
    const db = makeDb();
    const service = makeService(db);
    db.insert.mockReturnValue({
      values: () => ({
        returning: jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('dup'), { code: '23505' }),
          ),
      }),
    });

    await expect(
      service.createAdmin({
        modelId: 'm1',
        specGroups: [{ title: 'Display', rows: [{ label: 'A', value: 'B' }] }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a missing model to 400', async () => {
    const db = makeDb();
    const service = makeService(db);
    db.insert.mockReturnValue({
      values: () => ({
        returning: jest
          .fn()
          .mockRejectedValue(Object.assign(new Error('fk'), { code: '23503' })),
      }),
    });

    await expect(
      service.createAdmin({
        modelId: 'm1',
        specGroups: [{ title: 'Display', rows: [{ label: 'A', value: 'B' }] }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s an update on a missing page', async () => {
    const db = makeDb();
    const service = makeService(db);
    db.select.mockReturnValue(simpleSelect([]));

    await expect(
      service.updateAdmin('spec-1', { isPublished: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates groups and publish state', async () => {
    const db = makeDb();
    const service = makeService(db);
    db.select
      .mockReturnValueOnce(simpleSelect([{ id: 'spec-1' }]))
      .mockReturnValueOnce(selectChain([detailRow]).chain);
    const set = jest.fn(() => ({ where: jest.fn() }));
    db.update.mockReturnValue({ set });

    await service.updateAdmin('spec-1', {
      specGroups: [
        { title: 'Battery', rows: [{ label: 'Capacity', value: '3561 mAh' }] },
      ],
      isPublished: false,
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ isPublished: false }),
    );
  });

  it('404s a delete on a missing page', async () => {
    const db = makeDb();
    const service = makeService(db);
    db.delete.mockReturnValue({
      where: () => ({ returning: jest.fn().mockResolvedValue([]) }),
    });

    await expect(service.removeAdmin('spec-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes the page', async () => {
    const db = makeDb();
    const service = makeService(db);
    db.delete.mockReturnValue({
      where: () => ({
        returning: jest.fn().mockResolvedValue([{ id: 'spec-1' }]),
      }),
    });

    await expect(service.removeAdmin('spec-1')).resolves.toEqual({
      id: 'spec-1',
    });
  });
});
