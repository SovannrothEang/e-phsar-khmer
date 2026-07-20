import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';

function makeDb() {
  return {
    select: jest.fn(),
    selectDistinctOn: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeService(db: ReturnType<typeof makeDb>) {
  const supabase = {
    getPublicUrl: jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/img.jpg' },
    })),
  };
  const config = { get: jest.fn(() => 'listings') };
  const service = new ChatService(
    db as never,
    supabase as never,
    config as never,
  );
  return { service, supabase };
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
});

describe('ChatService.getMessages', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ChatService;

  beforeEach(() => {
    db = makeDb();
    ({ service } = makeService(db));
  });

  it('throws NotFoundException for an unknown conversation', async () => {
    db.select.mockReturnValue(limitQuery([]));

    await expect(service.getMessages('u1', 'c-unknown', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException for a non-participant', async () => {
    db.select.mockReturnValue(
      limitQuery([{ ...conversation, userAId: 'x1', userBId: 'x2' }]),
    );

    await expect(service.getMessages('u1', 'c1', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when cursor and after are both set', async () => {
    db.select.mockReturnValue(limitQuery([conversation]));

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
      if (callCount === 1) return limitQuery([conversation]);
      if (callCount === 2) return pageQuery([m3, m2, m1]); // limit+1 rows
      return whereQuery([{ last: null }]); // peerLastReadAt
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
      if (callCount === 1) return limitQuery([conversation]);
      if (callCount === 2) return pageQuery([m4, m5]);
      return whereQuery([{ last: readDate }]);
    });

    const after = encodeCursor(new Date('2026-07-13T10:03:00.000Z'), 'm3');
    const result = await service.getMessages('u1', 'c1', { after });

    expect(result.data.map((m) => m.id)).toEqual(['m4', 'm5']);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.nextCursor).toBeNull();
    expect(decodeCursor(result.meta.latestCursor!).id).toBe('m5');
    expect(result.meta.peerLastReadAt).toBe(readDate);
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
});
