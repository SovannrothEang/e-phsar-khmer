import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDemoListings } from './listings.seed';
import { photoPlanFor, type PhotoPlan } from './photo-plan';
import {
  PHOTO_CACHE_DIR,
  PHOTO_CREDITS_PATH,
  type PhotoCredit,
} from './photo-cache';

/**
 * Downloads one Wikimedia Commons photo per demo-listing photo key into
 * `.seed-cache/photos/` (git-ignored) and records where each came from in
 * `photo-credits.json` (committed — Commons files are CC/public-domain and
 * their licence asks for attribution). Run: `pnpm --filter backend
 * db:fetch-photos`. Resumable: a key already cached is skipped, and the credits
 * file is rewritten after every key so a rate-limit stop loses nothing.
 */

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'psa-npic-demo-seed/1.0 (dev seed script)';
const BAD_TITLE =
  /interior|engine|logo|badge|dashboard|cockpit|wheel|rim|headlight|taillight|steering|trunk|diagram|map|screenshot|sticker|emblem|crash|accident|wreck|museum|gauge|speedometer|odometer|console|pedal|gearbox|earphone|earbud|headphone|mansion|library|manual|spectromet|hands-on|vp9|scan|pdf|shimano|bicycle|keyboard|trackpad|camera of|MET\s+[A-Z]{3}\d|corolla cross/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').trim();

interface CommonsPage {
  index: number;
  title: string;
  imageinfo?: {
    thumburl?: string;
    url: string;
    width: number;
    mime: string;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
}

/** Retries rate limits with a growing pause; an exhausted retry returns {}. */
async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) {
      await sleep(8000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }
  return {};
}

async function search(
  photoKey: string,
  query: string,
  must: string | undefined,
): Promise<PhotoCredit | null> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1000',
    format: 'json',
  });
  const json = (await getJson(`${API}?${params}`)) as {
    query?: { pages?: Record<string, CommonsPage> };
  };
  const pages = Object.values(json.query?.pages ?? {}).sort(
    (a, b) => a.index - b.index,
  );
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    if (!/^image\/(jpeg|png)$/.test(info.mime) || info.width < 700) continue;
    if (BAD_TITLE.test(page.title)) continue;
    if (must && !norm(page.title).includes(must)) continue;

    const res = await fetch(info.thumburl, { headers: { 'User-Agent': UA } });
    if (!res.ok) continue;
    const file = `${photoKey}.${info.mime === 'image/png' ? 'png' : 'jpg'}`;
    writeFileSync(
      join(PHOTO_CACHE_DIR, file),
      Buffer.from(await res.arrayBuffer()),
    );
    const meta = info.extmetadata ?? {};
    return {
      key: photoKey,
      query,
      file,
      title: page.title,
      pageUrl: info.descriptionurl,
      author: stripHtml(meta.Artist?.value ?? 'Unknown'),
      license: meta.LicenseShortName?.value ?? 'Unknown',
    };
  }
  return null;
}

async function findPhoto(plan: PhotoPlan): Promise<PhotoCredit> {
  const attempts = [
    { query: plan.query, must: plan.must },
    ...(plan.alts ?? []),
  ];
  for (const [i, attempt] of attempts.entries()) {
    const hit = await search(plan.key, attempt.query, attempt.must);
    if (hit) return i === 0 ? hit : { ...hit, approx: true };
    await sleep(1200);
  }
  return { key: plan.key, query: plan.query, miss: true };
}

async function main() {
  mkdirSync(PHOTO_CACHE_DIR, { recursive: true });
  const credits = new Map<string, PhotoCredit>(
    existsSync(PHOTO_CREDITS_PATH)
      ? (
          JSON.parse(readFileSync(PHOTO_CREDITS_PATH, 'utf8')) as PhotoCredit[]
        ).map((c) => [c.key, c])
      : [],
  );
  const save = () =>
    writeFileSync(
      PHOTO_CREDITS_PATH,
      JSON.stringify([...credits.values()], null, 2) + '\n',
    );

  const plans = new Map<string, PhotoPlan>();
  for (const demo of buildDemoListings()) {
    const plan = photoPlanFor(demo);
    if (plan.query && !plans.has(plan.key)) plans.set(plan.key, plan);
  }

  let found = 0;
  const misses: string[] = [];
  for (const plan of plans.values()) {
    const prior = credits.get(plan.key);
    if (prior?.file && existsSync(join(PHOTO_CACHE_DIR, prior.file))) {
      found++;
      continue;
    }
    const credit = await findPhoto(plan);
    credits.set(plan.key, credit);
    save();
    if (credit.miss) misses.push(`${plan.key} ("${plan.query}")`);
    else found++;
    console.log(
      credit.miss
        ? `  ✗ ${plan.key}`
        : `  ✓ ${plan.key}${credit.approx ? ' (approx)' : ''} ← ${credit.title}`,
    );
    await sleep(1500);
  }

  console.log(
    `\n${found}/${plans.size} photos cached; ${misses.length} missed`,
  );
  for (const m of misses) console.log(`  missed: ${m}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
