import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { feedback } from '../../db/schema';
import { FilesService } from '../../files/files.service';

export interface AdminFeedbackItem {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  description: string;
  imagePaths: string[];
  /** Public URLs derived from `imagePaths` — the admin table renders these. */
  imageUrls: string[];
  createdAt: Date;
}

@Injectable()
export class AdminFeedbackService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly filesService: FilesService,
  ) {}

  async list(): Promise<AdminFeedbackItem[]> {
    const rows = await this.db
      .select()
      .from(feedback)
      .orderBy(desc(feedback.createdAt));

    return rows.map((row) => ({
      ...row,
      imageUrls: row.imagePaths.map((path) =>
        this.filesService.getPublicUrl(path),
      ),
    }));
  }

  async remove(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .delete(feedback)
      .where(eq(feedback.id, id))
      .returning({ id: feedback.id });
    if (!row) throw new NotFoundException('Feedback not found');
    return row;
  }
}
