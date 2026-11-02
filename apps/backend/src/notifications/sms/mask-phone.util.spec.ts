import { maskPhone } from './mask-phone.util';

describe('maskPhone', () => {
  it('keeps only the last two digits', () => {
    expect(maskPhone('+855 12 345 678')).toBe('*********78');
  });

  it('returns null for a missing or empty phone', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
    expect(maskPhone('')).toBeNull();
  });

  it('masks a very short number entirely', () => {
    expect(maskPhone('12')).toBe('**');
    expect(maskPhone('1')).toBe('*');
  });
});
