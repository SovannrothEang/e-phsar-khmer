import { PgDialect } from 'drizzle-orm/pg-core';
import { NotificationsService } from './notifications.service';

function makeDb() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeService(db: ReturnType<typeof makeDb>) {
  // No channels needed: the delete paths never touch `notify`.
  return new NotificationsService(db as never, [] as never);
}

/** .delete().where(<captured>).returning(…) → rows */
function deleteQuery(capture: { where?: unknown }, rows: unknown[]) {
  return {
    where: (where: unknown) => {
      capture.where = where;
      return { returning: () => Promise.resolve(rows) };
    },
  };
}

const compileWhere = (where: unknown) =>
  new PgDialect().sqlToQuery(where as never);

describe('NotificationsService deletes', () => {
  let db: ReturnType<typeof makeDb>;
  let service: NotificationsService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  describe('remove', () => {
    it('scopes the DELETE to the owner as well as the id', async () => {
      const capture: { where?: unknown } = {};
      db.delete.mockReturnValue(deleteQuery(capture, [{ id: 'n1' }]));

      await expect(service.remove('u1', 'n1')).resolves.toEqual({ deleted: 1 });

      // Both predicates have to be in the WHERE: an id-only delete would let
      // any signed-in user delete any notification by guessing a UUID.
      const { sql, params } = compileWhere(capture.where);
      expect(sql).toContain('id');
      expect(sql).toContain('user_id');
      expect(params).toContain('n1');
      expect(params).toContain('u1');
    });

    it('reports 0 — not an error — for a row that is not this user’s', async () => {
      db.delete.mockReturnValue(deleteQuery({}, []));
      await expect(service.remove('u1', 'someone-elses-id')).resolves.toEqual({
        deleted: 0,
      });
    });
  });

  describe('removeAll', () => {
    it('deletes only this user’s rows and counts them', async () => {
      const capture: { where?: unknown } = {};
      db.delete.mockReturnValue(
        deleteQuery(capture, [{ id: 'a' }, { id: 'b' }]),
      );

      await expect(service.removeAll('u1')).resolves.toEqual({ deleted: 2 });

      const { sql, params } = compileWhere(capture.where);
      expect(sql).toContain('user_id');
      // Scoped by owner and by nothing else — no is_read predicate, so read
      // rows go too.
      expect(sql).not.toContain('is_read');
      expect(params).toEqual(['u1']);
    });
  });
});
