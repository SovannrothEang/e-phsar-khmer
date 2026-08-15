import * as bcrypt from 'bcrypt';
import { isNull } from 'drizzle-orm';
import type { DbClient } from '../drizzle.provider';
import { users } from '../schema/users.schema';

/**
 * Idempotently upserts a single bootstrap admin account so the admin dashboard
 * has something to log in with. Users normally register via phone OTP and carry
 * no password hash; admins authenticate by username + password, so this seed
 * sets `passwordHash` + `role: 'super_admin'` directly.
 *
 * Env-driven:
 *   ADMIN_SEED_USERNAME  (default 'admin')
 *   ADMIN_SEED_PASSWORD  (required — skipped with a warning if unset)
 *   ADMIN_SEED_PHONE     (optional, stored as primaryPhone)
 */
export async function seedAdmin(db: DbClient): Promise<void> {
  const username = process.env.ADMIN_SEED_USERNAME ?? 'admin';
  const password = process.env.ADMIN_SEED_PASSWORD;
  const phone = process.env.ADMIN_SEED_PHONE ?? null;

  if (!password) {
    console.log(
      '  ⚠ ADMIN_SEED_PASSWORD not set — skipping admin bootstrap seed.',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role: 'super_admin',
      status: 'active',
      primaryPhone: phone,
    })
    .onConflictDoUpdate({
      target: users.username,
      targetWhere: isNull(users.deletedAt),
      set: { passwordHash, role: 'super_admin', status: 'active' },
    });

  console.log(`  ✓ admin user '${username}'`);
}
