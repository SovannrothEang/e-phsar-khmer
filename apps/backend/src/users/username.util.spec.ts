import { buildUsernameBase, normalizeUsername } from './username.util';

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
    ['John', 'Doe', 'JohnDoe'],
    ['John', null, 'John'],
    [null, 'Doe', 'Doe'],
    [null, null, null],
    ['', '   ', null],
    ['  Mary Jane ', 'Watson', 'MaryJaneWatson'],
    ['john', 'doe', 'johndoe'],
  ] as const)('buildUsernameBase(%p, %p) === %p', (first, last, expected) => {
    expect(buildUsernameBase(first, last)).toBe(expected);
  });
});
