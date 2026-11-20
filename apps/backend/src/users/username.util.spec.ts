import { PgDialect } from 'drizzle-orm/pg-core';
import {
  buildUsernameBase,
  generateUniqueUsername,
  isValidManualUsername,
  normalizeAdminUsername,
  normalizeManualUsername,
  normalizeUsername,
  recordUsernameChange,
} from './username.util';

describe('normalizeUsername', () => {
  it.each([
    ['JohnDoe', 'johndoe'],
    ['ALICE', 'alice'],
    ['user_01', 'user_01'],
  ] as const)('normalizeUsername(%p) === %p', (input, expected) => {
    expect(normalizeUsername(input)).toBe(expected);
  });

  it('returns equal output for canonically-equivalent Unicode forms', () => {
    const composed = 'café'; // é precomposed
    const decomposed = 'café'; // e + combining acute
    expect(normalizeUsername(decomposed)).toBe(normalizeUsername(composed));
  });
});

describe('buildUsernameBase', () => {
  it.each([
    ['John', 'Doe', 'John-Doe'],
    ['John', null, 'John'],
    [null, 'Doe', 'Doe'],
    [null, null, null],
    ['', '   ', null],
    ['  Mary Jane ', 'Watson', 'Mary-Jane-Watson'],
    ['john', 'doe', 'john-doe'],
    // Unicode survives untouched; only the join separator is added.
    ['សុខ', 'ដារា', 'សុខ-ដារា'],
    // Repeated and edge hyphens collapse to one internal separator.
    ['A--B', 'C', 'A-B-C'],
    ['-A-', '-B-', 'A-B'],
    // Punctuation that cannot appear in a handle is dropped.
    ["O'Brien", 'Smith', 'OBrien-Smith'],
    // No usable letters/numbers at all — the account gets no username.
    ['!!!', '😀', null],
  ] as const)('buildUsernameBase(%p, %p) === %p', (first, last, expected) => {
    expect(buildUsernameBase(first, last)).toBe(expected);
  });

  it('composes NFD input to NFC', () => {
    expect(buildUsernameBase('Café', 'X')).toBe('Café-X');
  });

  it('caps the base at 50 characters without ending on a hyphen', () => {
    const base = buildUsernameBase('a'.repeat(49) + '-', 'b'.repeat(10));
    expect(base).toBe('a'.repeat(49));
    expect(base).toHaveLength(50 - 1);
  });
});

describe('normalizeManualUsername / isValidManualUsername', () => {
  it.each([
    ['  Sok--Dara  ', 'sok-dara'],
    ['--a--', 'a'],
    ['Sok.Dara', 'sok.dara'],
    ['café', 'café'],
    ['សុខ-ដារា', 'សុខ-ដារា'],
  ] as const)('normalizeManualUsername(%p) === %p', (input, expected) => {
    expect(normalizeManualUsername(input)).toBe(expected);
  });

  it('accepts Unicode handles that the generated rule can produce', () => {
    expect(isValidManualUsername('sok-dara')).toBe(true);
    expect(isValidManualUsername('សុខ-ដារា')).toBe(true);
    expect(isValidManualUsername('Sok.Dara_01')).toBe(true);
  });

  it('rejects short, long, and out-of-charset handles', () => {
    expect(isValidManualUsername('ab')).toBe(false);
    expect(isValidManualUsername('')).toBe(false);
    expect(isValidManualUsername('a'.repeat(51))).toBe(false);
    expect(isValidManualUsername('sok dara')).toBe(false);
    expect(isValidManualUsername('sok@dara')).toBe(false);
    expect(isValidManualUsername('sok--dara')).toBe(true); // collapsed before the check
  });
});

describe('normalizeAdminUsername', () => {
  it('trims and composes NFC but keeps the typed casing', () => {
    expect(normalizeAdminUsername('  SokDara ')).toBe('SokDara');
    expect(normalizeAdminUsername('Café')).toBe('Café');
  });
});

function generateDb(taken: boolean[]) {
  let call = 0;
  const capture: { where?: unknown } = {};
  const chain = {
    select: () => chain,
    from: () => chain,
    where: (where: unknown) => {
      capture.where = where;
      return chain;
    },
    limit: () => {
      const occupied = taken[call] ?? false;
      call += 1;
      return Promise.resolve(occupied ? [{ id: 'user-taken' }] : []);
    },
  };
  return { db: chain as never, capture };
}

describe('generateUniqueUsername', () => {
  it('joins the generated name with a hyphen when the base is free', async () => {
    const { db } = generateDb([false]);
    await expect(generateUniqueUsername(db, 'John-Doe')).resolves.toBe(
      'john-doe',
    );
  });

  it('suffixes a collision with -2 and then -3', async () => {
    const first = generateDb([true, false]);
    await expect(generateUniqueUsername(first.db, 'John-Doe')).resolves.toBe(
      'john-doe-2',
    );

    const second = generateDb([true, true, false]);
    await expect(generateUniqueUsername(second.db, 'John-Doe')).resolves.toBe(
      'john-doe-3',
    );
  });

  it('keeps the suffixed candidate within 50 characters', async () => {
    const base = 'a'.repeat(50);
    const { db } = generateDb([true, false]);
    const result = await generateUniqueUsername(db, base);
    expect(result).toHaveLength(50);
    expect(result.endsWith('-2')).toBe(true);
  });

  it('probes case-insensitively across every row, soft-deleted included', async () => {
    const { db, capture } = generateDb([false]);
    await generateUniqueUsername(db, 'John-Doe');

    const { sql, params } = new PgDialect().sqlToQuery(capture.where as never);
    expect(sql).toContain('lower(');
    expect(sql).toContain('"username"');
    expect(sql).not.toContain('"deleted_at"');
    expect(params).toContain('john-doe');
  });
});

describe('recordUsernameChange', () => {
  function historyDb() {
    const values = jest.fn();
    const onConflictDoUpdate = jest.fn(() => Promise.resolve());
    const insert = jest.fn(() => ({
      values: (row: unknown) => {
        values(row);
        return { onConflictDoUpdate };
      },
    }));
    return { db: { insert } as never, insert, values, onConflictDoUpdate };
  }

  it('aliases the released handle, normalized to lowercase', async () => {
    const { db, values, onConflictDoUpdate } = historyDb();
    await recordUsernameChange(db, 'user-1', 'Old.Name', 'new-name');

    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      username: 'old.name',
    });
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for a case-only change or a missing handle', async () => {
    const caseOnly = historyDb();
    await recordUsernameChange(caseOnly.db, 'user-1', 'SokDara', 'sokdara');
    expect(caseOnly.insert).not.toHaveBeenCalled();

    const missing = historyDb();
    await recordUsernameChange(missing.db, 'user-1', null, 'sokdara');
    expect(missing.insert).not.toHaveBeenCalled();
  });
});
