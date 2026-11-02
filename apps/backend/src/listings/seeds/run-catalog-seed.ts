import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../db/schema';
import { seedProducts } from '../../products/seeds/products.seed';
import { seedListings } from './listings.seed';
import { seedListingPhotos } from './photos.seed';

/**
 * Runs only the demo catalogue (`pnpm --filter backend db:seed:catalog`):
 * spec pages, the demo listings and their photos. The full `db:seed` also
 * rewrites geography, categories and attributes, which is slow against the
 * remote database and unnecessary when only the catalogue changed. Needs the
 * categories, brands and models seeded already.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const client = postgres(url, { prepare: false, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema, casing: 'snake_case' });
    console.log('Seeding product spec pages...');
    await seedProducts(db);
    console.log('Seeding demo listings...');
    await seedListings(db);
    console.log('Attaching listing photos...');
    await seedListingPhotos(db);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
