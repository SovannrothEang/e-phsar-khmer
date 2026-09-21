import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';

function makeDb() {
  const db = {
    select: jest.fn(),
    selectDistinctOn: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  // Default no-op chain: sendMessage advances the conversation watermark after
  // inserting the message. Tests that assert on it override this.
  db.update.mockReturnValue({
    set: () => ({ where: () => Promise.resolve(undefined) }),
  });
  return db;
}

function makeService(db: ReturnType<typeof makeDb>) {
  const supabase = {
    getPublicUrl: jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/img.jpg' },
    })),
  };
  const config = { get: jest.fn(() => 'listings') };
  const pubsub = { publish: jest.fn(() => Promise.resolve()) };
  const service = new ChatService(
    db as never,
    supabase as never,
    config as never,
    pubsub as never,
  );
  return { service, supabase, pubsub };
}

// .from().where().limit() → rows
function limitQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

// .from().where() → rows
function whereQuery(rows: unknown[]) {
  return { from: () => ({ where: () => Promise.resolve(rows) }) };
}

// .from().leftJoin().where().groupBy().limit() → rows
// (getMessages' combined conversation-auth + peerLastReadAt lookup)
function pollQuery(rows: unknown[]) {
  return {
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          groupBy: () => ({ limit: () => Promise.resolve(rows) }),
        }),
      }),
    }),
  };
}

// .from().where().orderBy() → rows
function orderByQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ orderBy: () => Promise.resolve(rows) }) }),
  };
}

// .from().where().orderBy().limit() → rows
function pageQuery(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => ({ limit: () => Promise.resolve(rows) }),
      }),
    }),
  };
}

// .from().where().groupBy() → rows
function groupByQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ groupBy: () => Promise.resolve(rows) }) }),
  };
}

// .from().innerJoin().where() → rows
function joinQuery(rows: unknown[]) {
  return {
    from: () => ({ innerJoin: () => ({ where: () => Promise.resolve(rows) }) }),
  };
}

/**
 * Every string literal reachable from a drizzle SQL predicate. Drizzle's SQL
 * objects hold cyclic table references, so JSON.stringify cannot be used to
 * inspect them.
 */
function collectStrings(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value as Record<string, unknown>).flatMap((v) =>
    collectStrings(v, seen),
  );
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
    createdAt: string;
    id: string;
  };
}

const NOW = new Date('2026-07-13T10:00:00.000Z');

// Cursor ids are compared against `uuid` columns, so decodeCursor only accepts
// UUIDs. Tests that put an id INSIDE a cursor must use these; ids that are only
// ever asserted on (message row ids) stay readable.
const UUID = {
  m5: '55555555-5555-4555-8555-555555555555',
  mA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  mB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
} as const;

// A real UUID for the sender, so imagePath ownership tests exercise the same
// shape production does (`chat/{uuid}/{uuid}-{name}`).
const SENDER = '11111111-1111-4111-8111-111111111111';
const VICTIM = '22222222-2222-4222-8222-222222222222';

const conversation = {
  id: 'c1',
  userAId: 'u1',
  userBId: 'u2',
  lastMessageAt: NOW,
  createdAt: NOW,
};

function makeMessage(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    conversationId: 'c1',
    senderId: 'u2',
    body: 'hi',
    listingId: null,
    imageUrl: null,
    imagePath: null,
    readAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('ChatService.sendMessage', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;
  let supabase: { getPublicUrl: jest.Mock };

  beforeEach(() => {
    db = makeDb();
    ({ service, supabase } = makeService(db));
  });

  function mockInserts(captured: Record<string, unknown>[]) {
    db.insert.mockImplementation(() => ({
      values: (v: Record<string, unknown>) => {
        captured.push(v);
        return {
          onConflictDoUpdate: () => ({
            returning: () => Promise.resolve([conversation]),
          }),
          returning: () =>
            Promise.resolve([
              makeMessage('m1', { senderId: 'u1', ...captured[1] }),
            ]),
        };
      },
    }));
  }

  it('throws BadRequestException when messaging yourself', async () => {
    await expect(
      service.sendMessage('u1', { recipientId: 'u1', body: 'hi' }),
    ).rejects.toThrow(BadRequestException);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when neither body nor imagePath present', async () => {
    await expect(
      service.sendMessage('u1', { recipientId: 'u2' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when imagePath is outside own chat folder', async () => {
    await expect(
      service.sendMessage('u1', {
        recipientId: 'u2',
        imagePath: 'chat/u9/pic.jpg',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when imagePath contains a traversal', async () => {
    await expect(
      service.sendMessage('u1', {
        recipientId: 'u2',
        imagePath: 'chat/u1/../u9/pic.jpg',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when recipient is missing or soft-deleted', async () => {
    db.select.mockReturnValue(limitQuery([]));

    await expect(
      service.sendMessage('u1', { recipientId: 'u2', body: 'hi' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when a block exists in either direction', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]); // recipient
      return limitQuery([{ id: 'block-1' }]); // block row
    });

    await expect(
      service.sendMessage('u1', { recipientId: 'u2', body: 'hi' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when listing belongs to neither participant', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]); // recipient
      if (callCount === 2) return limitQuery([]); // no block
      return limitQuery([{ id: 'l1', userId: 'u9' }]); // foreign listing
    });

    await expect(
      service.sendMessage('u1', {
        recipientId: 'u2',
        body: 'hi',
        listingId: 'l1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('creates the conversation and message on happy text send', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]);
      return limitQuery([]); // no block
    });
    const captured: Record<string, unknown>[] = [];
    mockInserts(captured);

    const result = await service.sendMessage('u1', {
      recipientId: 'u2',
      body: 'hi',
    });

    expect(result.conversationId).toBe('c1');
    expect(result.message.listing).toBeNull();
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(captured[0]).toMatchObject({ userAId: 'u1', userBId: 'u2' });
    expect(captured[1]).toMatchObject({
      conversationId: 'c1',
      senderId: 'u1',
      body: 'hi',
      imageUrl: null,
    });
  });

  it('advances the conversation watermark to the message createdAt', async () => {
    // lastMessageAt is the inbox ordering key, so it must not lag the newest
    // message: the pre-insert upsert bump happens before the message row
    // exists, and under concurrent sends the two can commit out of order.
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]);
      return limitQuery([]);
    });
    mockInserts([]);
    const sets: Record<string, unknown>[] = [];
    db.update.mockImplementation(() => ({
      set: (v: Record<string, unknown>) => {
        sets.push(v);
        return { where: () => Promise.resolve(undefined) };
      },
    }));

    await service.sendMessage('u1', { recipientId: 'u2', body: 'hi' });

    expect(sets).toEqual([{ lastMessageAt: NOW }]);
  });

  it('canonicalizes the pair order regardless of sender', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u1' }]);
      return limitQuery([]);
    });
    const captured: Record<string, unknown>[] = [];
    mockInserts(captured);

    await service.sendMessage('u2', { recipientId: 'u1', body: 'yo' });

    expect(captured[0]).toMatchObject({ userAId: 'u1', userBId: 'u2' });
  });

  it('derives imageUrl from imagePath on image send', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]);
      return limitQuery([]);
    });
    const captured: Record<string, unknown>[] = [];
    mockInserts(captured);

    await service.sendMessage('u1', {
      recipientId: 'u2',
      imagePath: 'chat/u1/pic.jpg',
    });

    expect(supabase.getPublicUrl).toHaveBeenCalledWith(
      'listings',
      'chat/u1/pic.jpg',
    );
    expect(captured[1]).toMatchObject({
      imageUrl: 'https://cdn.example.com/img.jpg',
      imagePath: 'chat/u1/pic.jpg',
      body: null,
    });
  });

  it('attaches the listing context card on listing send', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]); // recipient
      if (callCount === 2) return limitQuery([]); // no block
      if (callCount === 3) return limitQuery([{ id: 'l1', userId: 'u2' }]); // listing owned by recipient
      if (callCount === 4)
        return whereQuery([
          {
            id: 'l1',
            title: 'iPhone 13 Pro',
            price: '520.00',
            currency: 'USD',
            status: 'active',
          },
        ]);
      return orderByQuery([{ listingId: 'l1', url: 'https://cdn/p1.jpg' }]);
    });
    const captured: Record<string, unknown>[] = [];
    mockInserts(captured);

    const result = await service.sendMessage('u1', {
      recipientId: 'u2',
      body: 'Is this available?',
      listingId: 'l1',
    });

    expect(result.message.listing).toEqual({
      id: 'l1',
      title: 'iPhone 13 Pro',
      price: '520.00',
      currency: 'USD',
      status: 'active',
      thumbnailUrl: 'https://cdn/p1.jpg',
    });
  });

  const e2eHeader = {
    v: 1 as const,
    dh: 'ratchet-pub-key',
    pn: 0,
    n: 0,
    identityKey: 'idkey',
    ephemeralKey: 'ephkey',
    oneTimePrekeyId: 3,
    signedPrekeyId: 1,
  };

  it('throws BadRequestException when e2eHeader is combined with imagePath', async () => {
    await expect(
      service.sendMessage('u1', {
        recipientId: 'u2',
        imagePath: 'chat/u1/pic.jpg',
        e2eHeader,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('stores isE2e: true and the e2eHeader when present', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]);
      return limitQuery([]);
    });
    const captured: Record<string, unknown>[] = [];
    mockInserts(captured);

    await service.sendMessage('u1', {
      recipientId: 'u2',
      body: 'ciphertext-blob',
      e2eHeader,
    });

    expect(captured[1]).toMatchObject({
      body: 'ciphertext-blob',
      isE2e: true,
      e2eHeader,
    });
  });

  it('stores isE2e: false and a null e2eHeader on a plaintext send', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: 'u2' }]);
      return limitQuery([]);
    });
    const captured: Record<string, unknown>[] = [];
    mockInserts(captured);

    await service.sendMessage('u1', { recipientId: 'u2', body: 'hi' });

    expect(captured[1]).toMatchObject({ isE2e: false, e2eHeader: null });
  });
});

describe('ChatService.getMessages', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  it('throws NotFoundException for an unknown conversation', async () => {
    db.select.mockReturnValue(pollQuery([]));

    await expect(service.getMessages('u1', 'c-unknown', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException for a non-participant', async () => {
    db.select.mockReturnValue(
      pollQuery([{ ...conversation, userAId: 'x1', userBId: 'x2' }]),
    );

    await expect(service.getMessages('u1', 'c1', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when cursor and after are both set', async () => {
    db.select.mockReturnValue(pollQuery([conversation]));

    await expect(
      service.getMessages('u1', 'c1', { cursor: 'a', after: 'b' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('pages history DESC with nextCursor and latestCursor', async () => {
    const m3 = makeMessage('m3', {
      createdAt: new Date('2026-07-13T10:03:00.000Z'),
    });
    const m2 = makeMessage('m2', {
      createdAt: new Date('2026-07-13T10:02:00.000Z'),
    });
    const m1 = makeMessage('m1', {
      createdAt: new Date('2026-07-13T10:01:00.000Z'),
    });
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      // #1 carries peerLastReadAt (null here) alongside the conversation row
      if (callCount === 1)
        return pollQuery([{ ...conversation, peerLastReadAt: null }]);
      return pageQuery([m3, m2, m1]); // limit+1 rows
    });

    const result = await service.getMessages('u1', 'c1', { limit: 2 });

    expect(result.data.map((m) => m.id)).toEqual(['m3', 'm2']);
    expect(result.meta.hasMore).toBe(true);
    expect(decodeCursor(result.meta.nextCursor!).id).toBe('m2');
    expect(decodeCursor(result.meta.latestCursor!).id).toBe('m3');
    expect(result.meta.peerLastReadAt).toBeNull();
  });

  it('returns deltas ASC in after mode with peerLastReadAt watermark', async () => {
    const readDate = new Date('2026-07-13T10:05:00.000Z');
    const m4 = makeMessage('m4', {
      createdAt: new Date('2026-07-13T10:04:00.000Z'),
    });
    const m5 = makeMessage('m5', {
      createdAt: new Date('2026-07-13T10:05:00.000Z'),
    });
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      // The conversation watermark tracks the newest message (m5), so it is
      // past the client's cursor and the range scan must run.
      if (callCount === 1)
        return pollQuery([
          {
            ...conversation,
            lastMessageAt: m5.createdAt,
            peerLastReadAt: readDate,
          },
        ]);
      return pageQuery([m4, m5]);
    });

    const after = encodeCursor(new Date('2026-07-13T10:03:00.000Z'), 'm3');
    const result = await service.getMessages('u1', 'c1', { after });

    expect(result.data.map((m) => m.id)).toEqual(['m4', 'm5']);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.nextCursor).toBeNull();
    expect(decodeCursor(result.meta.latestCursor!).id).toBe('m5');
    expect(result.meta.peerLastReadAt).toBe(readDate);
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});

describe('ChatService.getMessages delta polling', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  const watermark = new Date('2026-07-13T10:05:00.000Z');
  const atWatermark = encodeCursor(watermark, UUID.m5);

  // Conversation whose newest message is m5 — i.e. the client is caught up.
  function quietConversation(peerLastReadAt: Date | null) {
    return { ...conversation, lastMessageAt: watermark, peerLastReadAt };
  }

  // Auth/peerLastReadAt lookup, then the message range scan.
  function mockPoll(conv: Record<string, unknown>, rows: unknown[]) {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return pollQuery([conv]);
      return pageQuery(rows);
    });
  }

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  // REGRESSION: a `lastMessageAt <= cursor.createdAt` fast path used to answer
  // this poll with an empty page, permanently. The watermark carries no id, so
  // when two messages share a millisecond it cannot tell "client has both" from
  // "client has the lower-id one" — and the second message was never delivered
  // until unrelated later traffic moved the watermark. Always scan.
  it('delivers a same-millisecond message the watermark cannot distinguish', async () => {
    const mB = makeMessage('mB', { id: UUID.mB, createdAt: watermark });
    // Client holds (T, mA); mB committed at the same T with a higher id, so
    // lastMessageAt === the client's cursor timestamp.
    mockPoll(quietConversation(null), [mB]);

    const result = await service.getMessages('u1', 'c1', {
      after: encodeCursor(watermark, UUID.mA),
    });

    expect(result.data.map((m) => m.id)).toEqual([UUID.mB]);
    expect(decodeCursor(result.meta.latestCursor!).id).toBe(UUID.mB);
    // The range scan ran rather than being skipped on the watermark.
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('scans on a caught-up delta poll instead of trusting the watermark', async () => {
    mockPoll(quietConversation(null), []);

    const result = await service.getMessages('u1', 'c1', {
      after: atWatermark,
    });

    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.nextCursor).toBeNull();
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('keeps returning a fresh peerLastReadAt on empty polls', async () => {
    // The peer marks my messages read. That moves messages.read_at but NOT
    // conversations.last_message_at, so an empty delta must still surface it —
    // otherwise read receipts freeze until someone sends a new message.
    const readDate = new Date('2026-07-13T10:07:30.000Z');
    mockPoll(quietConversation(readDate), []);

    const result = await service.getMessages('u1', 'c1', {
      after: atWatermark,
    });

    expect(result.data).toEqual([]);
    expect(result.meta.peerLastReadAt).toBe(readDate);

    // ...and a later receipt is picked up on the next equally-empty poll
    const laterReadDate = new Date('2026-07-13T10:09:00.000Z');
    mockPoll(quietConversation(laterReadDate), []);

    const next = await service.getMessages('u1', 'c1', { after: atWatermark });
    expect(next.data).toEqual([]);
    expect(next.meta.peerLastReadAt).toBe(laterReadDate);
  });

  it('echoes the client cursor as latestCursor on an empty poll', async () => {
    mockPoll(quietConversation(null), []);

    const result = await service.getMessages('u1', 'c1', {
      after: atWatermark,
    });

    // Not null: a client that stores meta.latestCursor must not lose its
    // watermark and re-fetch the whole thread on the next poll.
    expect(result.meta.latestCursor).toBe(atWatermark);
  });

  it('returns new messages when the watermark is newer than the cursor', async () => {
    const m6 = makeMessage('m6', {
      createdAt: new Date('2026-07-13T10:06:00.000Z'),
    });
    mockPoll(
      { ...conversation, lastMessageAt: m6.createdAt, peerLastReadAt: null },
      [m6],
    );

    const result = await service.getMessages('u1', 'c1', {
      after: atWatermark,
    });

    expect(result.data.map((m) => m.id)).toEqual(['m6']);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('ignores an unparseable after cursor', async () => {
    mockPoll(quietConversation(null), []);

    const result = await service.getMessages('u1', 'c1', {
      after: '!!not-a-cursor!!',
    });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(result.meta.latestCursor).toBeNull();
  });
});

describe('ChatService.markRead', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  it('throws NotFoundException for an unknown conversation', async () => {
    db.select.mockReturnValue(limitQuery([]));

    await expect(service.markRead('u1', 'c1')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('marks all unread messages from the other user', async () => {
    db.select.mockReturnValue(limitQuery([conversation]));
    db.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 'm1' }, { id: 'm2' }]),
        }),
      }),
    });

    const result = await service.markRead('u1', 'c1');
    expect(result).toEqual({ marked: 2 });
  });
});

describe('ChatService.getInbox', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  it('short-circuits batch loads on an empty page', async () => {
    db.select.mockReturnValue(pageQuery([]));

    const result = await service.getInbox('u1', {});

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      nextCursor: null,
      hasMore: false,
      limit: 20,
    });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.selectDistinctOn).not.toHaveBeenCalled();
  });

  it('ignores an invalid cursor', async () => {
    db.select.mockReturnValue(pageQuery([]));

    await expect(
      service.getInbox('u1', { cursor: '!!not-a-cursor!!' }),
    ).resolves.toBeDefined();
  });

  it('assembles otherUser, lastMessage and unreadCount per conversation', async () => {
    const lastMessage = makeMessage('m9');
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return pageQuery([conversation]);
      if (callCount === 2)
        return groupByQuery([{ conversationId: 'c1', count: 3 }]);
      return whereQuery([
        { id: 'u2', username: 'dara', profilePhotoUrl: null },
      ]);
    });
    db.selectDistinctOn.mockReturnValue(orderByQuery([lastMessage]));

    const result = await service.getInbox('u1', {});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'c1',
      otherUser: { id: 'u2', username: 'dara', profilePhotoUrl: null },
      unreadCount: 3,
    });
    expect(result.data[0].lastMessage).toEqual(lastMessage);
    expect(result.meta.hasMore).toBe(false);
  });
});

describe('ChatService.getUnreadCount', () => {
  it('returns the total across all conversations', async () => {
    const db = makeDb();
    const { service } = makeService(db);
    db.select.mockReturnValue(joinQuery([{ total: 5 }]));

    await expect(service.getUnreadCount('u1')).resolves.toEqual({ total: 5 });
  });
});

describe('ChatService.getConversationWith', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  it('throws BadRequestException for yourself', async () => {
    await expect(service.getConversationWith('u1', 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException when the user is missing or soft-deleted', async () => {
    db.select.mockReturnValue(limitQuery([]));

    await expect(service.getConversationWith('u1', 'u2')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns a null conversation when none exists yet', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return limitQuery([
          { id: 'u2', username: 'dara', profilePhotoUrl: null },
        ]);
      if (callCount === 2) return whereQuery([]); // no blocks
      return limitQuery([]); // no conversation
    });

    const result = await service.getConversationWith('u1', 'u2');

    expect(result).toEqual({
      conversation: null,
      otherUser: { id: 'u2', username: 'dara', profilePhotoUrl: null },
      blockedByMe: false,
      canMessage: true,
    });
  });

  it('reports blockedByMe and canMessage flags', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return limitQuery([
          { id: 'u2', username: 'dara', profilePhotoUrl: null },
        ]);
      if (callCount === 2)
        return whereQuery([{ blockerId: 'u1', blockedId: 'u2' }]);
      return limitQuery([]);
    });

    const result = await service.getConversationWith('u1', 'u2');

    expect(result.blockedByMe).toBe(true);
    expect(result.canMessage).toBe(false);
  });

  it('never creates a conversation (read-only contract)', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return limitQuery([
          { id: 'u2', username: 'dara', profilePhotoUrl: null },
        ]);
      if (callCount === 2) return whereQuery([]);
      return limitQuery([]);
    });

    await service.getConversationWith('u1', 'u2');

    // A resolve endpoint that upserted would let anyone plant a thread in a
    // stranger's inbox — and would bypass the block check sendMessage does.
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('exposes only the narrow ChatUserSummary allow-list', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return limitQuery([
          { id: 'u2', username: 'dara', profilePhotoUrl: null },
        ]);
      if (callCount === 2) return whereQuery([]);
      return limitQuery([]);
    });

    const result = await service.getConversationWith('u1', 'u2');

    // No phone, email, deletedAt or verification timestamps may ride along.
    expect(Object.keys(result.otherUser).sort()).toEqual([
      'id',
      'profilePhotoUrl',
      'username',
    ]);
  });
});

describe('ChatService imagePath ownership (security)', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  // Every one of these attaches an object the sender does not own. They must
  // all be rejected BEFORE any DB work happens — hence the `db.select`
  // assertion: the check is the first gate in sendMessage.
  const attacks: [string, string][] = [
    ["another user's folder", `chat/${VICTIM}/pic.jpg`],
    ['literal traversal', `chat/${SENDER}/../${VICTIM}/pic.jpg`],
    ['deep literal traversal', `chat/${SENDER}/../../chat/${VICTIM}/pic.jpg`],
    ['percent-encoded traversal', `chat/${SENDER}/%2e%2e/${VICTIM}/pic.jpg`],
    ['double percent-encoded traversal', `chat/${SENDER}/%252e%252e/x.jpg`],
    ['encoded separator', `chat/${SENDER}%2f..%2f${VICTIM}/pic.jpg`],
    ['backslash traversal', `chat/${SENDER}/..\\${VICTIM}\\pic.jpg`],
    ['backslash separator', `chat\\${VICTIM}\\pic.jpg`],
    ['fullwidth-dot traversal', `chat/${SENDER}/．．/${VICTIM}/p.jpg`],
    ['nested subfolder', `chat/${SENDER}/sub/pic.jpg`],
    ['trailing slash', `chat/${SENDER}/pic.jpg/`],
    ['bare folder', `chat/${SENDER}/`],
    ['dot segment', `chat/${SENDER}/.`],
    ['dotdot segment', `chat/${SENDER}/..`],
    ['leading slash', `/chat/${SENDER}/pic.jpg`],
    ['other scope', `avatar/${VICTIM}/pic.jpg`],
    ['absolute url', `https://evil.example.com/chat/${SENDER}/pic.jpg`],
    ['null byte', `chat/${SENDER}/pic.jpg\u0000.txt`],
    ['space in name', `chat/${SENDER}/pic .jpg`],
    ['empty path', ''],
    ['over-long name', `chat/${SENDER}/${'a'.repeat(201)}.jpg`],
    ['newline', `chat/${SENDER}/pic\n.jpg`],
  ];

  it.each(attacks)('rejects %s', async (_label, imagePath) => {
    await expect(
      service.sendMessage(SENDER, { recipientId: VICTIM, imagePath }),
    ).rejects.toThrow(BadRequestException);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('rejects a sender id that is merely a prefix of the path segment', async () => {
    // Equality, not startsWith: `chat/{SENDER}extra/` must not pass for SENDER.
    await expect(
      service.sendMessage(SENDER, {
        recipientId: VICTIM,
        imagePath: `chat/${SENDER}extra/pic.jpg`,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts the exact path shape the signer produces', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([{ id: VICTIM }]);
      return limitQuery([]); // no block
    });
    db.insert.mockImplementation(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve([conversation]),
        }),
        returning: () => Promise.resolve([makeMessage('m1')]),
      }),
    }));

    const path = `chat/${SENDER}/3f1a9c22-0d4e-4a11-9f80-2b7c6de51aa4-my_photo.jpg`;
    await expect(
      service.sendMessage(SENDER, { recipientId: VICTIM, imagePath: path }),
    ).resolves.toBeDefined();
  });
});

describe('ChatService conversation authorisation (security)', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  const foreign = { ...conversation, userAId: 'x1', userBId: 'x2' };

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  // 404, never 403. A 403 would confirm the conversation exists and turn the
  // id space into an enumeration oracle for "who is talking to whom".
  it('getMessages gives a non-participant 404, not 403', async () => {
    db.select.mockReturnValue(pollQuery([foreign]));

    const err: unknown = await service
      .getMessages('u1', 'c1', {})
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NotFoundException);
    expect(err).not.toBeInstanceOf(ForbiddenException);
  });

  it('markRead gives a non-participant 404, not 403', async () => {
    db.select.mockReturnValue(limitQuery([foreign]));

    const err: unknown = await service
      .markRead('u1', 'c1')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NotFoundException);
    expect(err).not.toBeInstanceOf(ForbiddenException);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('is indistinguishable between a foreign and a missing conversation', async () => {
    db.select.mockReturnValue(pollQuery([foreign]));
    const foreignErr = (await service
      .getMessages('u1', 'c1', {})
      .catch((e: unknown) => e)) as NotFoundException;

    db.select.mockReturnValue(pollQuery([]));
    const missingErr = (await service
      .getMessages('u1', 'c-nope', {})
      .catch((e: unknown) => e)) as NotFoundException;

    // Same status and same body — nothing distinguishes "exists but not yours"
    // from "does not exist".
    expect(foreignErr.getStatus()).toBe(missingErr.getStatus());
    expect(foreignErr.getResponse()).toEqual(missingErr.getResponse());
  });

  it('authorises before reading any message row', async () => {
    db.select.mockReturnValue(pollQuery([foreign]));

    await expect(service.getMessages('u1', 'c1', {})).rejects.toThrow(
      NotFoundException,
    );
    // Exactly one query: the auth lookup. No message scan was issued.
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

describe('ChatService cursor tampering (security)', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  // A cursor id lands in a comparison against a `uuid` column. Postgres answers
  // a non-UUID literal with 22P02, which surfaces as a 500 — a one-request
  // fault injection. Malformed ids must be ignored like any other bad cursor.
  const malformed = [
    'not-a-uuid',
    "' OR 1=1--",
    '00000000-0000-0000-0000-00000000000',
    '',
  ];

  it.each(malformed)('ignores a non-UUID cursor id (%s)', async (id) => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return pollQuery([{ ...conversation, peerLastReadAt: null }]);
      return pageQuery([]);
    });

    const result = await service.getMessages('u1', 'c1', {
      after: encodeCursor(NOW, id),
    });

    // Treated as absent, not passed through to the query layer.
    expect(result.meta.latestCursor).toBeNull();
    expect(result.data).toEqual([]);
  });

  it('ignores a non-UUID cursor id on the inbox', async () => {
    db.select.mockReturnValue(pageQuery([]));

    await expect(
      service.getInbox('u1', { cursor: encodeCursor(NOW, 'not-a-uuid') }),
    ).resolves.toMatchObject({ data: [] });
  });

  it('cannot reach another conversation with a forged cursor', async () => {
    // The cursor only ever moves a boundary; the conversation scope comes from
    // the participant-checked path param, so a forged cursor stays inside the
    // caller's own thread.
    const wheres: unknown[] = [];
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return pollQuery([{ ...conversation, peerLastReadAt: null }]);
      return {
        from: () => ({
          where: (w: unknown) => {
            wheres.push(w);
            return { orderBy: () => ({ limit: () => Promise.resolve([]) }) };
          },
        }),
      };
    });

    await service.getMessages('u1', 'c1', {
      after: encodeCursor(NOW, UUID.mA),
    });

    // One scan, and its predicate was built from the authorised id.
    expect(wheres).toHaveLength(1);
    expect(collectStrings(wheres[0])).toContain('c1');
  });
});
