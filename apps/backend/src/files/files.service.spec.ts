import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FilesService } from './files.service';

describe('FilesService', () => {
  let service: FilesService;
  let supabase: { removeObjects: jest.Mock };
  const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

  beforeEach(async () => {
    jest.clearAllMocks();
    supabase = { removeObjects: jest.fn().mockResolvedValue({ error: null }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: SupabaseService, useValue: supabase },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('listings') },
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  describe('removeByPublicUrl', () => {
    it('derives the object path from a Supabase public URL', async () => {
      const url =
        'https://xyz.supabase.co/storage/v1/object/public/listings/category/icon.png';
      await service.removeByPublicUrl(url);
      expect(supabase.removeObjects).toHaveBeenCalledWith('listings', [
        'category/icon.png',
      ]);
    });

    it('strips query params (cache-busting tokens) from the path', async () => {
      const url =
        'https://xyz.supabase.co/storage/v1/object/public/listings/category/icon.png?t=abc123';
      await service.removeByPublicUrl(url);
      expect(supabase.removeObjects).toHaveBeenCalledWith('listings', [
        'category/icon.png',
      ]);
    });

    it('URI-decodes percent-encoded characters in the path', async () => {
      const url =
        'https://xyz.supabase.co/storage/v1/object/public/listings/category/my%20icon.png';
      await service.removeByPublicUrl(url);
      expect(supabase.removeObjects).toHaveBeenCalledWith('listings', [
        'category/my icon.png',
      ]);
    });

    it('does nothing for null', async () => {
      await service.removeByPublicUrl(null);
      expect(supabase.removeObjects).not.toHaveBeenCalled();
    });

    it('does nothing for non-storage values like /placeholder.svg', async () => {
      await service.removeByPublicUrl('/placeholder.svg');
      expect(supabase.removeObjects).not.toHaveBeenCalled();
    });

    it('warns (but does not throw) for http URLs outside the bucket', async () => {
      await service.removeByPublicUrl('https://example.com/icon.png');
      expect(supabase.removeObjects).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot clean up'),
      );
    });

    it('logs a warning when removeObjects returns an error, and does not throw', async () => {
      supabase.removeObjects.mockResolvedValueOnce({
        error: { message: 'RLS denied' },
      });
      await expect(
        service.removeByPublicUrl(
          'https://xyz.supabase.co/storage/v1/object/public/listings/category/icon.png',
        ),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove 1 object(s)'),
      );
    });
  });

  describe('remove', () => {
    it('no-ops on empty paths', async () => {
      await service.remove('listings', []);
      expect(supabase.removeObjects).not.toHaveBeenCalled();
    });

    it('passes paths through to the storage client', async () => {
      await service.remove('listings', ['a.png', 'b.png']);
      expect(supabase.removeObjects).toHaveBeenCalledWith('listings', [
        'a.png',
        'b.png',
      ]);
    });
  });
});
