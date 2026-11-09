import {
  and,
  eq,
  getTableName,
  gt,
  isNull,
  sql,
  type Column,
  type SQL,
} from 'drizzle-orm';
import type { DbClient } from '../db/drizzle.provider';
import { userSubscriptions } from '../db/schema/subscriptions.schema';

/**
 * True while the user holds at least one current, unexpired paid plan.
 *
 * Paid verification is derived, never stored: an active row is the only
 * source of truth, so an expiry or a revoke removes `verifiedAccount` from
 * the next read with no sweep to miss. The partial index
 * `user_subscriptions_active_idx (user_id, expires_at) WHERE superseded_at
 * IS NULL` serves this lookup.
 */
export async function hasActivePaidSubscription(
  db: DbClient,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userSubscriptions.id })
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        isNull(userSubscriptions.supersededAt),
        gt(userSubscriptions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * The same predicate as a correlated subquery, for row selects that need a
 * seller's verification without an extra round trip. `userId` must be a real
 * column (e.g. `listings.userId`), not an arbitrary expression: the column is
 * emitted as a table-qualified identifier.
 *
 * The qualification is load-bearing. Drizzle renders a single-table select's
 * columns without their table name, so a bare `${userId}` interpolation inside
 * this subquery became `"id"` and bound to `user_subscriptions.id` instead of
 * correlating to the outer row — verifiedAccount was silently false. A
 * joined select rendered `"listings"."user_id"` and happened to work, which
 * is why the trap only showed up in the new users query.
 */
export function activePaidSubscriptionExistsSql(userId: Column): SQL<boolean> {
  const qualified = sql`${sql.identifier(getTableName(userId.table))}.${sql.identifier(userId.name)}`;
  return sql<boolean>`exists (
    select 1 from user_subscriptions us
    where us.user_id = ${qualified}
      and us.superseded_at is null
      and us.expires_at > now()
  )`;
}
