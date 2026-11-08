import { declaredTypeMatches, sniffImageType } from './image-sniff';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0]);
const gif = Buffer.from('GIF89a....', 'latin1');
const webp = (() => {
  const b = Buffer.alloc(16);
  b.write('RIFF', 0, 'latin1');
  b.write('WEBP', 8, 'latin1');
  return b;
})();
const avif = (() => {
  const b = Buffer.alloc(16);
  b.write('ftyp', 4, 'latin1');
  b.write('avif', 8, 'latin1');
  return b;
})();

describe('sniffImageType', () => {
  it.each([
    ['image/jpeg', jpeg],
    ['image/png', png],
    ['image/gif', gif],
    ['image/webp', webp],
    ['image/avif', avif],
  ])('recognises %s', (expected, buffer) => {
    expect(sniffImageType(buffer)).toBe(expected);
  });

  it('rejects a text file, an SVG and an empty buffer', () => {
    expect(sniffImageType(Buffer.from('id,name\n1,2\n'))).toBeNull();
    expect(
      sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from([0x89]))).toBeNull();
  });

  it('does not mistake a RIFF container that is not WebP', () => {
    const wav = Buffer.alloc(16);
    wav.write('RIFF', 0, 'latin1');
    wav.write('WAVE', 8, 'latin1');
    expect(sniffImageType(wav)).toBeNull();
  });

  it('accepts an avis brand (image sequence) as AVIF', () => {
    const avis = Buffer.alloc(16);
    avis.write('ftyp', 4, 'latin1');
    avis.write('avis', 8, 'latin1');
    expect(sniffImageType(avis)).toBe('image/avif');
  });
});

describe('declaredTypeMatches', () => {
  it('matches an exact declaration', () => {
    expect(declaredTypeMatches('image/png', 'image/png')).toBe(true);
    expect(declaredTypeMatches('IMAGE/PNG', 'image/png')).toBe(true);
  });

  it('accepts the image/jpg alias for a JPEG body', () => {
    expect(declaredTypeMatches('image/jpg', 'image/jpeg')).toBe(true);
  });

  it('rejects a text file sent as image/png', () => {
    // This is the exact shape of the reported hole: a renamed .txt.
    expect(declaredTypeMatches('image/png', 'image/jpeg')).toBe(false);
    expect(declaredTypeMatches('text/plain', 'image/png')).toBe(false);
  });
});
