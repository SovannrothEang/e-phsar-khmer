import { eq } from 'drizzle-orm';
import type { DbClient } from '../drizzle.provider';
import { reportReasons, userReports } from '../schema/reports.schema';

/**
 * The marker the old seed stamped on fabricated sample reports. Deleted on
 * every run (see below); kept as a named constant so the cleanup is exact.
 */
const SEED_REPORT_MARKER = 'Reported via seed for moderation testing.';

/**
 * Seeds the moderation picklist for both report target types. Idempotent:
 * reasons upsert on (targetType, reason) and only their sort order is
 * refreshed — existing rows keep their identity, so reports that reference
 * them stay valid.
 *
 * The 12 entries per type are the design's full lists; the first four of each
 * are the original rows and must keep their exact text (they are FK targets of
 * live reports).
 */
export async function seedReports(db: DbClient): Promise<void> {
  const reasons: Array<{
    targetType: 'user' | 'listing';
    reason: string;
    sortOrder: number;
  }> = [
    { targetType: 'user', reason: 'Suspicious Account', sortOrder: 1 },
    {
      targetType: 'user',
      reason: 'Seller not Responding / phone unreachable',
      sortOrder: 2,
    },
    { targetType: 'user', reason: 'Scam / Fraud', sortOrder: 3 },
    { targetType: 'user', reason: 'Selling Counterfeit Items', sortOrder: 4 },
    { targetType: 'user', reason: 'Product No Tax', sortOrder: 5 },
    { targetType: 'user', reason: 'Selling Prohibited Items', sortOrder: 6 },
    { targetType: 'user', reason: 'Invalid Pricing', sortOrder: 7 },
    { targetType: 'user', reason: 'Items Wrongly Categorized', sortOrder: 8 },
    { targetType: 'user', reason: 'Duplicate Post', sortOrder: 9 },
    { targetType: 'user', reason: 'Inappropriate Content', sortOrder: 10 },
    { targetType: 'user', reason: 'Spam', sortOrder: 11 },
    { targetType: 'user', reason: 'Other', sortOrder: 12 },
    { targetType: 'listing', reason: 'Suspicious Listing', sortOrder: 1 },
    { targetType: 'listing', reason: 'Product Already Sold', sortOrder: 2 },
    { targetType: 'listing', reason: 'Scam / Fraud', sortOrder: 3 },
    { targetType: 'listing', reason: 'Prohibited Item', sortOrder: 4 },
    {
      targetType: 'listing',
      reason: 'Selling Counterfeit Items',
      sortOrder: 5,
    },
    { targetType: 'listing', reason: 'Product No Tax', sortOrder: 6 },
    { targetType: 'listing', reason: 'Invalid Pricing', sortOrder: 7 },
    {
      targetType: 'listing',
      reason: 'Items Wrongly Categorized',
      sortOrder: 8,
    },
    { targetType: 'listing', reason: 'Duplicate Post', sortOrder: 9 },
    { targetType: 'listing', reason: 'Inappropriate Content', sortOrder: 10 },
    { targetType: 'listing', reason: 'Spam', sortOrder: 11 },
    { targetType: 'listing', reason: 'Other', sortOrder: 12 },
  ];

  for (const r of reasons) {
    await db
      .insert(reportReasons)
      .values(r)
      .onConflictDoUpdate({
        target: [reportReasons.targetType, reportReasons.reason],
        set: { sortOrder: r.sortOrder },
      });
  }

  // The previous seed also inserted a sample user report on every run. There
  // is no unique constraint for `onConflictDoNothing` to fire on, so dev
  // accumulated 56 pending reports against real accounts. Approving one now
  // suspends the target and bans their phone, so these rows are dangerous:
  // delete them by their exact marker (idempotent — 0 rows after the first
  // run) and never fabricate sample reports again.
  await db
    .delete(userReports)
    .where(eq(userReports.description, SEED_REPORT_MARKER));

  console.log('  ✓ report reasons (24); seeded sample reports removed');
}
