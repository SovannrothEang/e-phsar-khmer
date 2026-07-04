import { eq } from 'drizzle-orm';
import type { DbClient } from '../db/drizzle.provider';
import { users } from '../db/schema/users.schema';

export function normalizeUsername(username: string): string {
  return username.toLowerCase().normalize('NFC');
}

export async function generateUniqueUsername(
  db: DbClient,
  base: string,
): Promise<string> {
  const normalizedBase = normalizeUsername(base);
  let suffix = 0;

  while (true) {
    let candidate: string;
    if (suffix === 0) {
      candidate = normalizedBase;
    } else {
      const suffixStr = suffix.toString();
      candidate =
        normalizedBase.length + suffixStr.length > 50
          ? normalizedBase.slice(0, 50 - suffixStr.length) + suffixStr
          : normalizedBase + suffixStr;
    }

    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);

    if (!taken) return candidate;
    suffix = suffix === 0 ? 2 : suffix + 1;
  }
}

export function buildUsernameBase(
  firstName?: string | null,
  lastName?: string | null,
): string | null {
  const parts: string[] = [];
  for (const part of [firstName, lastName]) {
    if (part == null) continue;
    const cleaned = part.trim().replace(/\s+/g, '');
    if (cleaned.length > 0) parts.push(cleaned);
  }
  const result = parts.join('');
  return result.length > 0 ? result : null;
}
