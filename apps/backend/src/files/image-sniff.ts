/**
 * What a byte buffer actually is, from its magic bytes.
 *
 * The multipart `/files/*` endpoints used to trust the client's
 * `Content-Type`: a text file renamed `.png` and sent as `image/png` was
 * stored and served back from a public bucket. Extension and header are both
 * attacker-controlled, the first bytes of the file are not.
 *
 * Deliberately narrow — the five raster formats the bucket accepts. Anything
 * else (including SVG, which can carry script) is `null`.
 */
export type SniffedImageType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/avif';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** ISO-BMFF: `....ftyp` followed by the major brand. */
function isHeifBrand(buffer: Buffer, brand: string): boolean {
  // 4 bytes size + "ftyp" + brand, so the brand starts at offset 8.
  if (buffer.length < 12) return false;
  if (buffer.toString('latin1', 4, 8) !== 'ftyp') return false;
  return buffer.toString('latin1', 8, 12) === brand;
}

/**
 * The image type of `buffer`, or `null` when it is not one of the accepted
 * raster formats. Only the first bytes are inspected; no decoding happens.
 */
export function sniffImageType(buffer: Buffer): SniffedImageType | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF (SOI + first marker).
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE))
    return 'image/png';

  if (buffer.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';

  // WebP: "RIFF" + 4-byte size + "WEBP".
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  )
    return 'image/webp';

  // AVIF: an HEIF container whose major brand is avif/avis.
  if (isHeifBrand(buffer, 'avif') || isHeifBrand(buffer, 'avis'))
    return 'image/avif';

  return null;
}

/**
 * Whether the declared MIME matches the bytes. GIF keeps `image/gif` and HEIC
 * is *not* accepted by the bucket, so the comparison is exact except for the
 * one alias browsers send: `image/jpg`.
 */
export function declaredTypeMatches(
  declared: string,
  sniffed: SniffedImageType,
): boolean {
  const normalized = declared.trim().toLowerCase();
  if (normalized === 'image/jpg') return sniffed === 'image/jpeg';
  return normalized === sniffed;
}
