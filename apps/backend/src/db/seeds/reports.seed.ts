import { inArray } from 'drizzle-orm';
import type { DbClient } from '../drizzle.provider';
import { reportReasons, userReports } from '../schema/reports.schema';
import { users } from '../schema/users.schema';

/**
 * Seeds a moderation picklist (reasons for user & listing reports) plus a few
 * sample user reports so the admin report queue has data to show. Idempotent:
 * reasons upsert on (targetType, reason); sample reports are inserted only once
 * per reporter→target pair.
 */
export async function seedReports(db: DbClient): Promise<void> {
  const reasons: Array<{
    targetType: 'user' | 'listing';
    reason: string;
  }> = [
    { targetType: 'user', reason: 'Suspicious Account' },
    { targetType: 'user', reason: 'Seller not Responding / phone unreachable' },
    { targetType: 'user', reason: 'Scam / Fraud' },
    { targetType: 'user', reason: 'Selling Counterfeit Items' },
    { targetType: 'listing', reason: 'Suspicious Listing' },
    { targetType: 'listing', reason: 'Product Already Sold' },
    { targetType: 'listing', reason: 'Scam / Fraud' },
    { targetType: 'listing', reason: 'Prohibited Item' },
  ];

  for (const r of reasons) {
    await db
      .insert(reportReasons)
      .values(r)
      .onConflictDoNothing({
        target: [reportReasons.targetType, reportReasons.reason],
      });
  }

  // Pick two distinct non-admin users to fabricate a report pair.
  const sample = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ['user']))
    .limit(2);
  if (sample.length < 2) {
    console.log(
      '  ⚠ need ≥2 role=user users to seed sample reports — skipping',
    );
    return;
  }
  const [reporter, target] = sample;
  const [reason] = await db
    .select({ id: reportReasons.id })
    .from(reportReasons)
    .where(inArray(reportReasons.targetType, ['user']))
    .limit(1);

  await db
    .insert(userReports)
    .values({
      reporterId: reporter.id,
      targetUserId: target.id,
      reasonId: reason?.id ?? null,
      description: 'Reported via seed for moderation testing.',
      imagePaths: [],
      status: 'pending',
    })
    .onConflictDoNothing();
  console.log('  ✓ report reasons + sample user report');
}
