import * as bcrypt from 'bcrypt';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DbClient } from '../drizzle.provider';
import { users } from '../schema/users.schema';
import {
  normalizeAdminUsername,
  normalizeUsername,
} from '../../users/username.util';

/**
 * Idempotently upserts a single bootstrap admin account so the admin dashboard
 * has something to log in with. Users normally register via phone OTP and carry
 * no password hash; admins authenticate by username + password, so this seed
 * sets `passwordHash` + `role: 'super_admin'` directly.
 *
 * The username unique index is an expression index (`lower(username)`), so
 * `ON CONFLICT (username)` no longer matches — the lookup is explicit and
 * case-insensitive, then update-or-insert.
 *
 * Env-driven:
 *   ADMIN_SEED_USERNAME  (default 'admin')
 *   ADMIN_SEED_PASSWORD  (required — skipped with a warning if unset)
 *   ADMIN_SEED_PHONE     (optional, stored as primaryPhone)
 */
export async function seedAdmin(db: DbClient): Promise<void> {
  const username = normalizeAdminUsername(
    process.env.ADMIN_SEED_USERNAME ?? 'admin',
  );
  const password = process.env.ADMIN_SEED_PASSWORD;
  const phone = process.env.ADMIN_SEED_PHONE ?? null;

  if (!password) {
    console.log(
      '  ⚠ ADMIN_SEED_PASSWORD not set — skipping admin bootstrap seed.',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const usernameKey = normalizeUsername(username);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`lower(${users.username}) = ${usernameKey}`,
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: 'super_admin', status: 'active' })
      .where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({
      username,
      passwordHash,
      role: 'super_admin',
      status: 'active',
      primaryPhone: phone,
    });
  }

  console.log(`  ✓ admin user '${username}'`);
}
