import { PgDialect } from 'drizzle-orm/pg-core';
import {
  MAX_QUERY_TOKENS,
  MAX_TOKEN_LENGTH,
  escapeLike,
  keywordCondition,
  tokenizeQuery,
} from './keyword-search';

describe('escapeLike', () => {
  it.each([
    ['100%', '100\\%'],
    ['a_b', 'a\\_b'],
    ['c:\\path', 'c:\\\\path'],
    ['\\%_', '\\\\\\%\\_'],
    ['toyota', 'toyota'],
    ['ឡាន', 'ឡាន'], // Khmer passes through untouched
  ])('%s → %s', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});

describe('tokenizeQuery', () => {
  it('collapses whitespace', () => {
    expect(tokenizeQuery('  toyota \t  prius\n2015 ')).toEqual([
      'toyota',
      'prius',
      '2015',
    ]);
  });

  it(`caps at ${MAX_QUERY_TOKENS} tokens`, () => {
    expect(tokenizeQuery('a b c d e f g')).toHaveLength(MAX_QUERY_TOKENS);
  });

  it(`caps each token at ${MAX_TOKEN_LENGTH} chars`, () => {
    expect(tokenizeQuery('x'.repeat(80))[0]).toHaveLength(MAX_TOKEN_LENGTH);
  });

  it.each([undefined, '', '   '])('empty for %p', (q) => {
    expect(tokenizeQuery(q)).toEqual([]);
  });
});

describe('keywordCondition', () => {
  const compile = (q: string) => {
    const cond = keywordCondition(q);
    if (!cond) throw new Error('expected a condition');
    return new PgDialect().sqlToQuery(cond);
  };

  it('is undefined for a blank query', () => {
    expect(keywordCondition('  ')).toBeUndefined();
  });

  it('matches every token in title OR description, as bound params', () => {
    const { sql, params } = compile('toyota prius');
    expect(sql.match(/ilike/g)).toHaveLength(4);
    expect(sql).toMatch(/"title" ilike .* or .*"description" ilike/);
    expect(sql).not.toContain('toyota');
    expect(params).toEqual(['%toyota%', '%toyota%', '%prius%', '%prius%']);
  });

  it('escapes metacharacters so "%" matches literally', () => {
    const { params } = compile('%');
    expect(params).toEqual(['%\\%%', '%\\%%']);
  });
});
