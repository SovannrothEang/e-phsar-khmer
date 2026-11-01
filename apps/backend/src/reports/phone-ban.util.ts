import { eq } from 'drizzle-orm';
import type { DbClient } from '../db/drizzle.provider';
import { bannedPhones } from '../db/schema/reports.schema';

/**
 * The auth DTOs accept an optional leading `+`, and phone rows are stored as
 * submitted, so every ban lookup/insert goes through this one normalizer or a
 * `+855…` registration could walk past a ban recorded as `855…`.
 */
export function normalizePhoneE164(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

/** True when moderation has banned this number from (re-)registration. */
export async function isPhoneBanned(
  db: DbClient,
  phone: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: bannedPhones.id })
    .from(bannedPhones)
    .where(eq(bannedPhones.phone, normalizePhoneE164(phone)))
    .limit(1);
  return row !== undefined;
}
