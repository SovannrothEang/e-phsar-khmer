import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { users } from '../db/schema/users.schema';

const STALE_MS = 5 * 60 * 1000;

@Injectable()
export class ActivityService {
  private readonly lastTouch = new Map<string, number>();

  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  touch(userId: string): void {
    const now = Date.now();
    if (now - (this.lastTouch.get(userId) ?? 0) < STALE_MS) return;
    this.lastTouch.set(userId, now);
    void this.db
      .update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, userId));
  }
}
