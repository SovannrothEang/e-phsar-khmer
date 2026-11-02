import { join } from 'node:path';

/** Where fetched demo photos live (git-ignored) and the committed credits file. */
export const PHOTO_CACHE_DIR = join(process.cwd(), '.seed-cache', 'photos');
export const PHOTO_CREDITS_PATH = join(
  process.cwd(),
  'src',
  'listings',
  'seeds',
  'photo-credits.json',
);

/** One Wikimedia Commons file (or a miss) per photo key. */
export interface PhotoCredit {
  key: string;
  query: string;
  file?: string;
  title?: string;
  pageUrl?: string;
  author?: string;
  license?: string;
  /** Matched a looser same-family search, not the exact model. */
  approx?: true;
  miss?: true;
}
