import { PgDialect } from 'drizzle-orm/pg-core';
import {
  MAX_QUERY_TOKENS,
  MAX_TOKEN_LENGTH,
  canFuzzy,
  escapeLike,
  keywordCondition,
  relevanceExpr,
  resolveFeedOrdering,
  tokenizeQuery,
} from './keyword-search';

describe('canFuzzy', () => {
  it.each([
    ['toyta', true],
    ['bmw x5', false],
    ['', false],
    ['kia sorento', true],
  ])('%p → %p', (q, expected) => {
    expect(canFuzzy(q)).toBe(expected);
  });
});

describe('relevanceExpr', () => {
  it('scores phrase-in-title, title prefix and similarity, as float8', () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      relevanceExpr('  Toyota   Prius '),
    );
    expect(sql).toContain('word_similarity($3, "listings"."title")');
    expect(sql).toMatch(/::float8$/);
    // Normalized phrase; LIKE patterns escaped the same way as the filter.
    expect(params).toEqual(['%Toyota Prius%', 'Toyota Prius%', 'Toyota Prius']);
  });

  it('escapes metacharacters in its LIKE arms', () => {
    const { params } = new PgDialect().sqlToQuery(relevanceExpr('50%'));
    expect(params).toEqual(['%50\\%%', '50\\%%', '50%']);
  });
});

describe('resolveFeedOrdering', () => {
  it('attaches a score to relevance when there is a keyword', () => {
    const ordering = resolveFeedOrdering('relevance', 'toyota');
    expect(ordering.sort).toBe('relevance');
    expect(ordering).toHaveProperty('score');
  });

  it.each([undefined, '', '   '])(
    'falls back to newest for relevance without a keyword (%p)',
    (q) => {
      expect(resolveFeedOrdering('relevance', q)).toEqual({ sort: 'newest' });
    },
  );

  it('defaults to newest and passes other sorts through unscored', () => {
    expect(resolveFeedOrdering(undefined, 'toyota')).toEqual({
      sort: 'newest',
    });
    expect(resolveFeedOrdering('price_asc', 'toyota')).toEqual({
      sort: 'price_asc',
    });
  });
});

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

  it('fuzzy mode adds a word_similarity arm only for tokens of 4+ chars', () => {
    const cond = keywordCondition('bmw toyta', { fuzzy: true });
    const { sql, params } = new PgDialect().sqlToQuery(cond!);
    expect(sql.match(/word_similarity/g)).toHaveLength(1);
    expect(params).toEqual(expect.arrayContaining(['toyta', 0.4]));
  });

  it('escapes metacharacters so "%" matches literally', () => {
    const { params } = compile('%');
    expect(params).toEqual(['%\\%%', '%\\%%']);
  });
});
