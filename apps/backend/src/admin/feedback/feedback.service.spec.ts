import { NotFoundException } from '@nestjs/common';
import { AdminFeedbackService } from './feedback.service';

const CREATED = new Date('2026-10-21T00:00:00Z');
const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: null,
  name: 'Sok Dara',
  phone: '+855969990201',
  email: 'dara@example.com',
  description: 'Great app',
  imagePaths: ['feedback/abc/photo.webp'],
  createdAt: CREATED,
};

type MockDb = { select: jest.Mock; delete: jest.Mock };

function makeDb(): MockDb {
  return { select: jest.fn(), delete: jest.fn() };
}

const files = {
  getPublicUrl: (path: string) =>
    `https://example.supabase.co/storage/v1/object/public/listings/${path}`,
};

describe('AdminFeedbackService', () => {
  let db: MockDb;
  let service: AdminFeedbackService;

  beforeEach(() => {
    db = makeDb();
    service = new AdminFeedbackService(db as never, files as never);
  });

  it('lists rows newest first and derives public image URLs', async () => {
    const orderBy = jest.fn(() => Promise.resolve([ROW]));
    db.select.mockImplementation(() => ({
      from: () => ({ orderBy }),
    }));

    const [item] = await service.list();

    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(item).toEqual({
      ...ROW,
      imageUrls: [
        'https://example.supabase.co/storage/v1/object/public/listings/feedback/abc/photo.webp',
      ],
    });
  });

  it('404s deleting an unknown entry', async () => {
    db.delete.mockImplementation(() => ({
      where: () => ({ returning: () => Promise.resolve([]) }),
    }));
    await expect(service.remove(ROW.id)).rejects.toThrow(NotFoundException);
  });

  it('returns the deleted id', async () => {
    db.delete.mockImplementation(() => ({
      where: () => ({ returning: () => Promise.resolve([{ id: ROW.id }]) }),
    }));
    await expect(service.remove(ROW.id)).resolves.toEqual({ id: ROW.id });
  });
});
