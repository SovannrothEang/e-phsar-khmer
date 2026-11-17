import 'dotenv/config';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { listings } from '../../db/schema/listings.schema';
import { notifications } from '../../db/schema/notifications.schema';
import { listingReports } from '../../db/schema/reports.schema';
import { users } from '../../db/schema/users.schema';
import { InAppNotificationChannel } from '../../notifications/channels/in-app-notification.channel';
import { NotificationsService } from '../../notifications/notifications.service';
import { SettingsService } from '../../settings/settings.service';

/**
 * One-off backfill for owners who crossed the post-report threshold before
 * `alertIfPostThresholdReached` existed.
 *
 * Run from `apps/backend`:
 *   pnpm --filter backend db:backfill-post-thresholds -- --dry-run
 *   pnpm --filter backend db:backfill-post-thresholds
 *
 * `--refresh` updates the body/data of backfill rows written by an earlier
 * version of this script (for example after adding the account identity).
 *
 * Idempotent: an owner that already has a `report.threshold` notification with
 * `source: 'listing'` is skipped, so a second run sends nothing. This writes
 * the durable in-app rows only; the admin bell picks them up on its next read
 * (the realtime push belongs to the running app, not this script).
 */
const DRY_RUN = process.argv.includes('--dry-run');
const REFRESH = process.argv.includes('--refresh');

function whoLabel(
  row: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  },
  fallback: string,
): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || null;
  if (row.username)
    return name ? `@${row.username} (${name})` : `@${row.username}`;
  return name ?? fallback;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const client = postgres(url, { prepare: false, onnotice: () => {} });
  try {
    const db = drizzle(client, {
      casing: 'snake_case',
    });
    const settings = new SettingsService(db as never);
    const notificationsService = new NotificationsService(
      db as never,
      [new InAppNotificationChannel(db as never)],
      {} as never,
    );

    const threshold = await settings.postReportAlertThreshold();
    const rows = await db
      .select({
        userId: listings.userId,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        status: users.status,
        approved: count(),
      })
      .from(listingReports)
      .innerJoin(listings, eq(listings.id, listingReports.listingId))
      .leftJoin(users, eq(users.id, listings.userId))
      .where(eq(listingReports.status, 'approved'))
      .groupBy(
        listings.userId,
        users.username,
        users.firstName,
        users.lastName,
        users.status,
      )
      .orderBy(sql`count(*) desc`);

    const atOrAbove = rows.filter((row) => Number(row.approved) >= threshold);
    console.log(
      `Post threshold ${threshold}; ${atOrAbove.length} owner(s) at/above.`,
    );
    if (atOrAbove.length === 0) return;

    const staff = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.role, ['admin', 'super_admin']),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      );
    console.log(`Active staff: ${staff.length}.`);
    if (staff.length === 0) return;

    let sent = 0;
    let refreshed = 0;
    let skipped = 0;
    for (const row of atOrAbove) {
      const approved = Number(row.approved);
      const name =
        [row.firstName, row.lastName].filter(Boolean).join(' ') || null;
      const who = whoLabel(row, row.userId);
      const body =
        `${who} has ${approved} approved reports on their posts ` +
        `(post threshold ${threshold}). Review the account on the Users page.`;
      const data = {
        targetUserId: row.userId,
        targetUsername: row.username,
        targetName: name,
        targetStatus: row.status,
        approvedPostReports: approved,
        threshold,
        source: 'listing',
        backfill: true,
      };
      const [existing] = await db
        .select({
          id: notifications.id,
          backfill: sql<boolean>`coalesce(${notifications.data}->>'backfill', 'false') = 'true'`,
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, 'report.threshold'),
            sql`${notifications.data}->>'targetUserId' = ${row.userId}`,
            sql`${notifications.data}->>'source' = 'listing'`,
          ),
        )
        .limit(1);
      if (existing) {
        if (REFRESH && existing.backfill) {
          console.log(
            `${DRY_RUN ? 'would refresh' : 'refreshing'} ${who}: ${approved} approved post reports (threshold ${threshold}).`,
          );
          if (!DRY_RUN) {
            await db
              .update(notifications)
              .set({ body, data })
              .where(
                and(
                  eq(notifications.type, 'report.threshold'),
                  sql`${notifications.data}->>'targetUserId' = ${row.userId}`,
                  sql`${notifications.data}->>'source' = 'listing'`,
                  sql`${notifications.data}->>'backfill' = 'true'`,
                ),
              );
          }
          refreshed++;
          continue;
        }
        console.log(`skip ${who}: already has a post-threshold notice`);
        skipped++;
        continue;
      }

      console.log(
        `${DRY_RUN ? 'would notify' : 'notifying'} ${who}: ${approved} approved post reports (threshold ${threshold}).`,
      );
      if (DRY_RUN) {
        sent++;
        continue;
      }

      await notificationsService.notifyStaff({
        type: 'report.threshold',
        title: 'Account reached the post-report threshold',
        body,
        data,
      });
      sent++;
    }

    console.log(
      `${DRY_RUN ? 'Dry run complete' : 'Backfill complete'}: ${sent} owner(s) ${
        DRY_RUN ? 'would be notified' : 'notified'
      }, ${refreshed} refreshed, ${skipped} skipped.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
