import { resolveLocale } from './locale.util';

describe('resolveLocale', () => {
  it.each([
    ['km-KH,en;q=0.9', 'km'],
    ['zh-CN,en;q=0.8', 'zh'],
    ['zh', 'zh'],
    ['ZH', 'zh'],
    ['KM', 'km'],
    ['en-US', 'en'],
    ['fr', 'en'],
    [undefined, 'en'],
    ['', 'en'],
  ] as const)('resolveLocale(%p) === %p', (input, expected) => {
    expect(resolveLocale(input)).toBe(expected);
  });
});
