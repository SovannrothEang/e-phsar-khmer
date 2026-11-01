import { InsightsService } from './insights.service';

type MockDb = {
  select: jest.Mock;
  insert: jest.Mock;
};

function makeDb(): MockDb {
  return { select: jest.fn(), insert: jest.fn() };
}

function makeService(db: MockDb) {
  return new InsightsService(db as never);
}

/**
 * Awaitable query stub: the service awaits `.from().where()` for the listing
 * lookup and `.from().where().groupBy()` for the summary, so both chains end
 * in the same thenable object.
 */
function selectChain<T>(result: T[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = self;
  chain.where = self;
  chain.groupBy = self;
  chain.then = (resolve: (value: T[]) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function insertSpy(db: MockDb) {
  const values = jest.fn().mockResolvedValue(undefined);
  db.insert.mockReturnValue({ values });
  return values;
}

const LISTING_A = '11111111-1111-4111-8111-111111111111';
const LISTING_B = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const ACTOR = '44444444-4444-4444-8444-444444444444';

describe('InsightsService', () => {
  let db: MockDb;
  let service: InsightsService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  describe('record', () => {
    it('dedupes identical listing/type pairs in one batch', async () => {
      db.select.mockReturnValue(
        selectChain([{ id: LISTING_A, userId: OWNER }]),
      );
      const values = insertSpy(db);

      const result = await service.record(null, [
        { listingId: LISTING_A, type: 'view' },
        { listingId: LISTING_A, type: 'view' },
      ]);

      expect(values).toHaveBeenCalledWith([
        {
          listingId: LISTING_A,
          ownerId: OWNER,
          actorId: null,
          eventType: 'view',
        },
      ]);
      expect(result).toEqual({ recorded: 1 });
    });

    it('drops unknown listing ids without failing the batch', async () => {
      db.select.mockReturnValue(selectChain([]));
      const values = insertSpy(db);

      const result = await service.record(null, [
        { listingId: LISTING_A, type: 'view' },
      ]);

      expect(values).not.toHaveBeenCalled();
      expect(result).toEqual({ recorded: 0 });
    });

    it('skips the owner acting on their own listing', async () => {
      db.select.mockReturnValue(
        selectChain([{ id: LISTING_A, userId: ACTOR }]),
      );
      const values = insertSpy(db);

      const result = await service.record(ACTOR, [
        { listingId: LISTING_A, type: 'view' },
      ]);

      expect(values).not.toHaveBeenCalled();
      expect(result).toEqual({ recorded: 0 });
    });

    it('records anonymous events with a null actor', async () => {
      db.select.mockReturnValue(
        selectChain([{ id: LISTING_A, userId: OWNER }]),
      );
      const values = insertSpy(db);

      await service.record(null, [{ listingId: LISTING_A, type: 'chat' }]);

      expect(values).toHaveBeenCalledWith([
        {
          listingId: LISTING_A,
          ownerId: OWNER,
          actorId: null,
          eventType: 'chat',
        },
      ]);
    });

    it('keeps the valid rows when a batch mixes unknown, self and foreign', async () => {
      db.select.mockReturnValue(
        selectChain([
          { id: LISTING_A, userId: OWNER },
          { id: LISTING_B, userId: ACTOR },
        ]),
      );
      const values = insertSpy(db);

      const result = await service.record(ACTOR, [
        { listingId: LISTING_A, type: 'view' },
        { listingId: LISTING_B, type: 'view' },
        {
          listingId: '99999999-9999-4999-8999-999999999999',
          type: 'view',
        },
      ]);

      expect(values).toHaveBeenCalledWith([
        {
          listingId: LISTING_A,
          ownerId: OWNER,
          actorId: ACTOR,
          eventType: 'view',
        },
      ]);
      expect(result).toEqual({ recorded: 1 });
    });

    it('normalizes listing ids to lowercase', async () => {
      db.select.mockReturnValue(
        selectChain([{ id: LISTING_A, userId: OWNER }]),
      );
      const values = insertSpy(db);

      await service.record(null, [
        { listingId: LISTING_A.toUpperCase(), type: 'view' },
      ]);

      expect(values).toHaveBeenCalledWith([
        {
          listingId: LISTING_A,
          ownerId: OWNER,
          actorId: null,
          eventType: 'view',
        },
      ]);
    });
  });

  describe('summary', () => {
    it('maps every event type and computes engagement without impressions', async () => {
      db.select.mockReturnValue(
        selectChain([
          { type: 'impression', total: 5 },
          { type: 'view', total: 2 },
          { type: 'chat', total: 1 },
        ]),
      );

      await expect(service.summary(OWNER)).resolves.toEqual({
        impression: 5,
        engagement: 3,
        view: 2,
        chat: 1,
        call: 0,
        showContact: 0,
        applyJob: 0,
      });
    });

    it('returns all zeros when the owner has no events', async () => {
      db.select.mockReturnValue(selectChain([]));

      await expect(service.summary(OWNER)).resolves.toEqual({
        impression: 0,
        engagement: 0,
        view: 0,
        chat: 0,
        call: 0,
        showContact: 0,
        applyJob: 0,
      });
    });
  });
});
