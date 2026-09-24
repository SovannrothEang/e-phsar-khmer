import { findSlugCollisions } from './brands.seed';

/**
 * The guard exists because `onConflictDoNothing` drops a colliding model in
 * silence: two seeded names that slugify to the same value mean one of them
 * never reaches the database, and nothing says so. `Galaxy S25+` and
 * `Galaxy S25` did exactly that and the plain S21…S25 were missing for weeks
 * (migration `0020_fix_plus_model_slugs`).
 *
 * The distinction that matters in every test below: a re-run is not a collision.
 */
describe('findSlugCollisions', () => {
  const brandSlugToId = new Map([['samsung', 'brand-1']]);
  const key = (brandSlug: string, slug: string, name: string) => [
    `${brandSlugToId.get(brandSlug)}:${slug}`,
    { slug, name },
  ];

  it('flags a seeded name whose slug is held by a different name', () => {
    // The real shape of the bug: the "+" variant claimed `galaxy-s25` from the
    // plain one, so the plain model is the one that vanishes.
    const stored = new Map([key('samsung', 'galaxy-s25', 'Galaxy S25+')] as [
      string,
      { slug: string; name: string },
    ][]);

    const collisions = findSlugCollisions(
      [{ brandSlug: 'samsung', modelSlug: 'galaxy-s25', name: 'Galaxy S25' }],
      stored,
      brandSlugToId,
    );

    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toContain('Galaxy S25');
    expect(collisions[0]).toContain('Galaxy S25+');
    expect(collisions[0]).toContain('galaxy-s25');
  });

  it('does NOT flag an ordinary re-run, where the stored name matches', () => {
    // Every model "conflicts" on a re-seed. Flagging those would make the
    // warning fire ~390 times per run and be ignored.
    const stored = new Map([
      key('samsung', 'galaxy-s25', 'Galaxy S25'),
      key('samsung', 'galaxy-s25-plus', 'Galaxy S25+'),
    ] as [string, { slug: string; name: string }][]);

    const collisions = findSlugCollisions(
      [
        { brandSlug: 'samsung', modelSlug: 'galaxy-s25', name: 'Galaxy S25' },
        {
          brandSlug: 'samsung',
          modelSlug: 'galaxy-s25-plus',
          name: 'Galaxy S25+',
        },
      ],
      stored,
      brandSlugToId,
    );

    expect(collisions).toEqual([]);
  });

  it('does not flag a model that is simply not in the table yet', () => {
    const collisions = findSlugCollisions(
      [{ brandSlug: 'samsung', modelSlug: 'galaxy-s26', name: 'Galaxy S26' }],
      new Map(),
      brandSlugToId,
    );

    expect(collisions).toEqual([]);
  });

  it('ignores an unknown brand slug instead of throwing', () => {
    const collisions = findSlugCollisions(
      [{ brandSlug: 'ghost', modelSlug: 'x', name: 'X' }],
      new Map(),
      brandSlugToId,
    );

    expect(collisions).toEqual([]);
  });

  it('reports a repeated collision once', () => {
    const stored = new Map([key('samsung', 'galaxy-s25', 'Something Else')] as [
      string,
      { slug: string; name: string },
    ][]);

    const collisions = findSlugCollisions(
      [
        { brandSlug: 'samsung', modelSlug: 'galaxy-s25', name: 'Galaxy S25' },
        { brandSlug: 'samsung', modelSlug: 'galaxy-s25', name: 'Galaxy S25' },
      ],
      stored,
      brandSlugToId,
    );

    expect(collisions).toHaveLength(1);
  });
});
