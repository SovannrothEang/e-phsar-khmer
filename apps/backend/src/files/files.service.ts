import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get defaultBucket(): string {
    return (
      this.configService.get<string>('supabase.storageBucket') ?? 'listings'
    );
  }

  buildObjectPath(userId: string, scope: string, filename: string): string {
    const safe = this.safeName(filename);
    return `${scope}/${userId}/${randomUUID()}-${safe}`;
  }

  async uploadPublic(
    bucket: string,
    folder: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; path: string }> {
    this.validateImage(file);
    const path = this.buildObjectPath('public', folder, file.originalname);
    const { error } = await this.supabaseService.uploadObject(
      bucket,
      path,
      file.buffer,
      file.mimetype,
    );
    if (error) throw new ForbiddenException('Upload failed');
    const { data } = this.supabaseService.getPublicUrl(bucket, path);
    return { url: data.publicUrl, path };
  }

  async createSignedUploadUrl(
    bucket: string,
    folder: string,
    filename: string,
  ): Promise<{
    signedUrl: string;
    path: string;
    token: string;
    publicUrl: string;
  }> {
    const path = `${folder}/${randomUUID()}-${this.safeName(filename)}`;
    const { data, error } = await this.supabaseService.createSignedUploadUrl(
      bucket,
      path,
    );
    if (error || !data)
      throw new ForbiddenException('Failed to create signed upload URL');
    const { data: pub } = this.supabaseService.getPublicUrl(bucket, path);
    return {
      signedUrl: data.signedUrl,
      path,
      token: data.token,
      publicUrl: pub.publicUrl,
    };
  }

  async createSignedDownloadUrl(
    bucket: string,
    path: string,
    expiresIn = 3600,
  ): Promise<{ url: string }> {
    const { data, error } = await this.supabaseService.createSignedUrl(
      bucket,
      path,
      expiresIn,
    );
    if (error || !data)
      throw new ForbiddenException('Failed to create signed URL');
    return { url: data.signedUrl };
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    await this.supabaseService.removeObjects(bucket, paths);
  }

  /**
   * Best-effort cleanup of the storage object backing a public URL. Derives the
   * object path from the URL (only matches URLs pointing into the default
   * bucket), silently skips non-storage values (e.g. "/placeholder.svg"), and
   * swallows errors so a Supabase hiccup never fails a DB operation. Used by
   * admin services when an icon/image leaves the DB (entity delete or replace).
   */
  async removeByPublicUrl(publicUrl: string | null): Promise<void> {
    if (!publicUrl) return;
    const bucket = this.defaultBucket;
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const objectPath = publicUrl.slice(idx + marker.length);
    try {
      await this.supabaseService.removeObjects(bucket, [objectPath]);
    } catch {
      // Best-effort — don't surface storage failures from a delete/update.
    }
  }

  private validateImage(file: Express.Multer.File) {
    if (!file.mimetype.startsWith('image/')) {
      throw new ForbiddenException('Only image files are allowed');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new ForbiddenException('File size must not exceed 5MB');
    }
  }

  private safeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  getDefaultBucket() {
    return this.defaultBucket;
  }
}
