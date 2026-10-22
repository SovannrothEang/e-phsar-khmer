import { BadRequestException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import type { CreateFeedbackDto } from './dto/create-feedback.dto';

const USER = '11111111-1111-4111-8111-111111111111';
const CREATED = new Date('2026-10-21T00:00:00Z');

type MockDb = {
  insert: jest.Mock;
};

function makeDb(): MockDb {
  return { insert: jest.fn() };
}

function captureInsert(db: MockDb) {
  const sink: { values?: Record<string, unknown> } = {};
  db.insert.mockImplementation(() => ({
    values: (values: Record<string, unknown>) => ({
      returning: () => {
        sink.values = values;
        return Promise.resolve([{ id: 'fb-1', createdAt: CREATED }]);
      },
    }),
  }));
  return sink;
}

function dto(overrides: Partial<CreateFeedbackDto> = {}): CreateFeedbackDto {
  return {
    name: 'Sok Dara',
    phone: '+855969990201',
    description: 'The feed is great',
    ...overrides,
  };
}

describe('FeedbackService', () => {
  let db: MockDb;
  let service: FeedbackService;

  beforeEach(() => {
    db = makeDb();
    service = new FeedbackService(db as never);
  });

  it('inserts a trimmed row for an anonymous submitter', async () => {
    const sink = captureInsert(db);
    const result = await service.create(
      null,
      dto({ name: '  Sok Dara  ', description: '  Great app  ' }),
    );

    expect(result).toEqual({ id: 'fb-1', createdAt: CREATED });
    expect(sink.values).toEqual(
      expect.objectContaining({
        userId: null,
        name: 'Sok Dara',
        phone: '+855969990201',
        description: 'Great app',
        imagePaths: [],
      }),
    );
  });

  it('stamps the account id when the submission is signed in', async () => {
    const sink = captureInsert(db);
    await service.create(USER, dto());
    expect(sink.values?.userId).toBe(USER);
  });

  it('drops an empty email rather than storing an empty string', async () => {
    const sink = captureInsert(db);
    await service.create(null, dto({ email: '   ' }));
    expect(sink.values?.email).toBeNull();
  });

  it('rejects a whitespace-only name', async () => {
    await expect(service.create(null, dto({ name: '   ' }))).rejects.toThrow(
      BadRequestException,
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only description', async () => {
    await expect(
      service.create(null, dto({ description: '   ' })),
    ).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('accepts feedback/ paths and dedupes them', async () => {
    const sink = captureInsert(db);
    const path = 'feedback/abc/photo.webp';
    await service.create(null, dto({ imagePaths: [path, path] }));
    expect(sink.values?.imagePaths).toEqual([path]);
  });

  it('rejects a path outside the feedback/ namespace', async () => {
    await expect(
      service.create(null, dto({ imagePaths: ['report/abc/photo.webp'] })),
    ).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
