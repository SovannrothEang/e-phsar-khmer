import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import type { DbClient } from '../../db/drizzle.provider';
import { listings, listingPhotos } from '../../db/schema/listings.schema';
import { buildDemoListings } from './listings.seed';
import {
  PHOTO_CACHE_DIR,
  PHOTO_CREDITS_PATH,
  type PhotoCredit,
} from './photo-cache';
import { photoPlanFor } from './photo-plan';

/**
 * Attaches a real picture to every demo listing that has none (2026-11-01).
 * The pictures are the Wikimedia Commons files `db:fetch-photos` cached; each
 * is uploaded to Storage under its owner's own folder — `listing/{userId}/…`,
 * the same layout a signed upload produces — and recorded in `listing_photos`.
 * Idempotent: a listing that already has a photo is skipped, and an upload that
 * already exists is overwritten in place.
 */
export async function seedListingPhotos(db: DbClient): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'listings';
  if (!url || !serviceKey) {
    console.log('  ✗ skipped listing photos (Supabase env not set)');
    return;
  }
  if (!existsSync(PHOTO_CREDITS_PATH)) {
    console.log('  ✗ skipped listing photos (run db:fetch-photos first)');
    return;
  }

  const storage = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage.from(bucket);

  const credits = new Map(
    (JSON.parse(readFileSync(PHOTO_CREDITS_PATH, 'utf8')) as PhotoCredit[]).map(
      (c) => [c.key, c],
    ),
  );

  let attached = 0;
  const lacking: string[] = [];
  for (const demo of buildDemoListings()) {
    const plan = photoPlanFor(demo);
    if (!plan.query) {
      lacking.push(demo.title);
      continue;
    }
    const credit = credits.get(plan.key);
    const cached = credit?.file ? join(PHOTO_CACHE_DIR, credit.file) : null;
    if (!credit?.file || !cached || !existsSync(cached)) {
      lacking.push(demo.title);
      continue;
    }

    const [listing] = await db
      .select({ id: listings.id, userId: listings.userId })
      .from(listings)
      .where(eq(listings.title, demo.title))
      .limit(1);
    if (!listing) continue;
    const [hasPhoto] = await db
      .select({ id: listingPhotos.id })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, listing.id))
      .limit(1);
    if (hasPhoto) continue;

    const ext = extname(credit.file).toLowerCase();
    const path = `listing/${listing.userId}/seed-${plan.key}${ext}`;
    const { error } = await storage.upload(path, readFileSync(cached), {
      contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    });
    if (error) {
      console.warn(`  ✗ upload failed for "${demo.title}": ${error.message}`);
      continue;
    }
    await db.insert(listingPhotos).values({
      listingId: listing.id,
      url: storage.getPublicUrl(path).data.publicUrl,
      path,
      sort: 0,
    });
    attached++;
  }
  console.log(`  ✓ attached ${attached} listing photos`);
  if (lacking.length > 0) {
    console.log(`  ! no cached photo for ${lacking.length} listing(s):`);
    for (const title of lacking) console.log(`      ${title}`);
  }
}
