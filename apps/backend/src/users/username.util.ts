import { sql } from 'drizzle-orm';
import type { DbClient, DbExecutor } from '../db/drizzle.provider';
import { userUsernameHistory, users } from '../db/schema/users.schema';

export function normalizeUsername(username: string): string {
  return username.toLowerCase().normalize('NFC');
}

const MAX_USERNAME_LENGTH = 50;
/** Any script's letters/marks/numbers survive; everything else is stripped. */
const DISALLOWED_CHARS = /[^\p{L}\p{M}\p{N}._-]/gu;
const REPEATED_HYPHENS = /-{2,}/g;
const EDGE_HYPHENS = /^-+|-+$/g;
const MANUAL_USERNAME_SHAPE = /^[\p{L}\p{M}\p{N}._-]+$/u;

/** Cut to the column's 50-character limit without leaving a dangling hyphen. */
function capUsername(value: string): string {
  return Array.from(value)
    .slice(0, MAX_USERNAME_LENGTH)
    .join('')
    .replace(EDGE_HYPHENS, '');
}

function sanitizeGeneratedPart(part: string): string {
  return part
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, '-')
    .replace(DISALLOWED_CHARS, '')
    .replace(REPEATED_HYPHENS, '-')
    .replace(EDGE_HYPHENS, '');
}

/**
 * `firstname-lastname` from the registration names. Whitespace inside a part
 * becomes a hyphen, non-username characters are dropped, and the whole base is
 * capped so a suffix can still fit under the 50-character column.
 */
export function buildUsernameBase(
  firstName?: string | null,
  lastName?: string | null,
): string | null {
  const parts = [firstName, lastName]
    .filter((part): part is string => part != null)
    .map(sanitizeGeneratedPart)
    .filter((part) => part.length > 0);
  return parts.length > 0 ? capUsername(parts.join('-')) : null;
}

/**
 * The shape Settings → Change Username accepts: any script's letters, marks
 * and numbers plus `.` `_` `-`, trimmed, lowercased, with repeated and
 * leading/trailing hyphens collapsed away.
 */
export function normalizeManualUsername(value: string): string {
  return normalizeUsername(value.normalize('NFC').trim())
    .replace(REPEATED_HYPHENS, '-')
    .replace(EDGE_HYPHENS, '');
}

export function isValidManualUsername(value: string): boolean {
  const length = Array.from(value).length;
  return (
    length >= 3 &&
    length <= MAX_USERNAME_LENGTH &&
    MANUAL_USERNAME_SHAPE.test(value)
  );
}

/**
 * Admin-chosen handles keep their typed casing (the case-insensitive unique
 * index is what stops `SokDara` and `sokdara` coexisting); they are still
 * trimmed and NFC-composed so a URL can address them.
 */
export function normalizeAdminUsername(value: string): string {
  return value.normalize('NFC').trim();
}

function withSuffix(base: string, suffix: number): string {
  const tail = `-${suffix}`;
  const head = Array.from(base)
    .slice(0, MAX_USERNAME_LENGTH - tail.length)
    .join('')
    .replace(EDGE_HYPHENS, '');
  return `${head}${tail}`;
}

export async function generateUniqueUsername(
  db: DbClient,
  base: string,
): Promise<string> {
  const normalizedBase = capUsername(normalizeUsername(base));
  if (!normalizedBase) {
    throw new Error('username base is empty');
  }
  let suffix: number | null = null;

  while (true) {
    const candidate =
      suffix === null ? normalizedBase : withSuffix(normalizedBase, suffix);

    // Case-insensitive on purpose: Khmer has no case, but a mixed-case
    // admin-created handle must still block the lowercase variant. The probe
    // covers soft-deleted rows too, as before.
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${candidate}`)
      .limit(1);

    if (!taken) return candidate;
    suffix = suffix === null ? 2 : suffix + 1;
  }
}

/**
 * Remember the handle a user just released so its profile URL keeps working.
 * The upsert target is the handle itself: whoever released a name most
 * recently owns its alias. A current holder always wins over this table
 * (the public lookup only consults it when no account holds the handle).
 */
export async function recordUsernameChange(
  db: DbExecutor,
  userId: string,
  oldUsername: string | null,
  newUsername: string | null,
): Promise<void> {
  if (!oldUsername || !newUsername) return;
  const oldNormalized = normalizeUsername(oldUsername);
  const newNormalized = normalizeUsername(newUsername);
  // Case-only changes resolve through the case-insensitive lookup; no alias.
  if (!oldNormalized || oldNormalized === newNormalized) return;

  await db
    .insert(userUsernameHistory)
    .values({ userId, username: oldNormalized })
    .onConflictDoUpdate({
      target: userUsernameHistory.username,
      set: { userId, createdAt: new Date() },
    });
}
