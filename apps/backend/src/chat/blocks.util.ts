import { and, eq, or } from 'drizzle-orm';
import type { DbClient } from '../db/drizzle.provider';
import { userBlocks } from '../db/schema/users.schema';

/** True if either user has blocked the other, in either direction. */
export async function isBlockedEitherWay(
  db: DbClient,
  a: string,
  b: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}
