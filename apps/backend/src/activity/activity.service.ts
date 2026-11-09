import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { users } from '../db/schema/users.schema';

/**
 * Must stay below the BFF's 2-minute online window: a user who keeps making
 * authenticated requests has to keep a `last_seen_at` value that is newer than
 * the window, or an active session would read as offline between writes.
 */
const WRITE_THROTTLE_MS = 60 * 1000;

@Injectable()
export class ActivityService {
  private readonly lastTouch = new Map<string, number>();
  private readonly logger = new Logger(ActivityService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  touch(userId: string): void {
    const now = Date.now();
    if (now - (this.lastTouch.get(userId) ?? 0) < WRITE_THROTTLE_MS) return;
    this.lastTouch.set(userId, now);
    void this.db
      .update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, userId))
      // Fire-and-forget on purpose: a presence write must never fail the
      // request that triggered it. A rejected promise still has to be handled
      // or Node reports an unhandled rejection.
      .catch((err: unknown) => {
        this.logger.warn(
          `last_seen_at update failed for ${userId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }
}
