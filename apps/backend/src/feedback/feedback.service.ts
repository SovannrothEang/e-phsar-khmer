import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { feedback } from '../db/schema';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

export interface CreatedFeedback {
  id: string;
  createdAt: Date;
}

@Injectable()
export class FeedbackService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async create(
    userId: string | null,
    dto: CreateFeedbackDto,
  ): Promise<CreatedFeedback> {
    const name = dto.name.trim();
    const description = dto.description.trim();
    if (!name) throw new BadRequestException('NAME_REQUIRED');
    if (!description) throw new BadRequestException('DESCRIPTION_REQUIRED');

    // The anonymous sign door owns `feedback/`; anything else is not a path
    // this submission could have produced (the report module's rule).
    const imagePaths = [...new Set(dto.imagePaths ?? [])];
    for (const path of imagePaths) {
      if (!path.startsWith('feedback/')) {
        throw new BadRequestException('INVALID_IMAGE_PATH');
      }
    }

    const [row] = await this.db
      .insert(feedback)
      .values({
        userId,
        name,
        phone: dto.phone,
        email: dto.email?.trim() || null,
        description,
        imagePaths,
      })
      .returning({ id: feedback.id, createdAt: feedback.createdAt });

    return { id: row.id, createdAt: row.createdAt };
  }
}
