import type { DemoListing } from './listings.seed';

/**
 * Which picture each demo listing gets. `key` names the cached file (and the
 * Storage object); `query` is the Wikimedia Commons search; `must` is a
 * lowercase, alphanumeric-only fragment the matched file's title has to
 * contain, so "Toyota Camry" never settles for a photo of a different car.
 * No match → the photo seed renders a labelled product card instead.
 */
export interface PhotoPlan {
  key: string;
  query: string;
  must?: string;
  /** Looser searches tried in order when the exact one finds nothing. */
  alts?: { query: string; must?: string }[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Listings without a spec page: hand-picked searches, keyed by title. */
const OTHER_PHOTOS: Record<string, PhotoPlan> = {
  'Car AC Repair & Maintenance Service': {
    key: 'car-repair',
    query: 'car mechanic workshop repair',
    must: 'car',
  },
  'Hyundai Truck 2.5 Ton 2019': {
    key: 'hyundai-porter-truck',
    query: 'Hyundai Porter truck',
    must: 'porter',
  },
  'Vehicle Loan & Insurance Service': {
    key: 'car-insurance',
    query: 'car keys handover dealer',
    must: 'car',
  },
  'Tuk Tuk For Sale - Electric 2024': {
    key: 'tuk-tuk-cambodia',
    query: 'tuk tuk Cambodia',
    must: 'tuktuk',
  },
  'Car Spare Parts - Brake Pads & Filters': {
    key: 'brake-pads',
    query: 'brake pads car',
    must: 'brake',
  },
  'Used Truck Tires - Various Sizes': {
    key: 'truck-tires',
    query: 'truck tires stack',
    must: 'tire',
  },
  'Mini Bus 25 Seats For Rent': {
    key: 'minibus',
    query: 'Toyota Coaster minibus',
    must: 'coaster',
  },
  'Giant ATX 27.5 Mountain Bike': {
    key: 'giant-mountain-bike',
    query: 'Giant mountain bike',
    must: 'giant',
  },
  'Yamaha Exciter 150 2024': {
    key: 'yamaha-exciter',
    query: 'Yamaha Exciter 150',
    must: 'exciter',
  },
  'MacBook Air M3 13-inch 2024': {
    key: 'macbook-air-m3',
    query: 'MacBook Air M3',
    must: 'macbookair',
  },
  'LG 65-inch 4K Smart TV': {
    key: 'lg-smart-tv',
    query: 'LG smart TV 4K',
    must: 'lg',
  },
  'Brand New Villa Duplex for Sale': {
    key: 'villa-duplex',
    query: 'modern villa house Cambodia',
    must: 'villa',
  },
  'Land For Sale - Sihanoukville 600m²': {
    key: 'land-sihanoukville',
    query: 'Sihanoukville beach road',
    must: 'sihanoukville',
  },
  'New Sofa Set - 3 Seater + Armchair': {
    key: 'sofa-set',
    query: 'fabric sofa living room',
    must: 'sofa',
  },
  "Men's Polo Shirt - New Arrival": {
    key: 'polo-shirt',
    query: 'polo shirt',
    must: 'polo',
  },
  'Accountant wanted - Phnom Penh': {
    key: 'accountant-office',
    query: 'accountant calculator desk',
  },
  'iPad Air 11-inch M2 128GB Wi-Fi': {
    key: 'ipad-air-m2',
    query: 'iPad Air M2',
    must: 'ipadair',
  },
  'Samsung Galaxy Tab S9 256GB': {
    key: 'galaxy-tab-s9',
    query: 'Samsung Galaxy Tab S9',
    must: 'tabs9',
  },
  'Apple Watch Series 9 45mm GPS': {
    key: 'apple-watch-s9',
    query: 'Apple Watch Series 9',
    must: 'applewatch',
  },
  'Lenovo ThinkPad T14 Gen 3 - i7 16GB': {
    key: 'thinkpad-t14',
    query: 'Lenovo ThinkPad T14',
    must: 'thinkpad',
  },
  'Dell XPS 13 9315 - i5 8GB': {
    key: 'dell-xps-13',
    query: 'Dell XPS 13',
    must: 'xps',
  },
  'Samsung 55-inch Crystal UHD 4K TV': {
    key: 'samsung-tv',
    query: 'Samsung smart TV',
    must: 'samsung',
  },
  'Honda Scoopy 2023 - Cream': {
    key: 'honda-scoopy',
    query: 'Honda Scoopy',
    must: 'scoopy',
  },
  'Yamaha NMAX 155 2022 - Gray': {
    key: 'yamaha-nmax',
    query: 'Yamaha NMAX',
    must: 'nmax',
  },
  'Poodle Puppies - 2 Months, Vaccinated': {
    key: 'poodle-puppy',
    query: 'poodle puppy',
    must: 'poodle',
  },
  'Persian Kitten - Blue Eyes': {
    key: 'persian-kitten',
    query: 'Persian kitten',
    must: 'persian',
  },
  'Fresh Battambang Mangoes - 10kg Box': {
    key: 'mangoes',
    query: 'mangoes fruit',
    must: 'mango',
  },
  'Phka Rumduol Fragrant Rice - 25kg': {
    key: 'rice-grains',
    query: 'jasmine rice grains',
    must: 'rice',
  },
  'Home & Office Cleaning Service': {
    key: 'cleaning-service',
    query: 'professional house cleaning',
  },
  'Housekeeper / Maid Wanted - Phnom Penh': {
    key: 'housekeeper',
    query: 'housekeeper cleaning room',
  },
  'University Textbooks Bundle - Business & IT': {
    key: 'textbooks',
    query: 'stack of textbooks',
    must: 'book',
  },
  'Yonex Badminton Racket Set (2 Rackets)': {
    key: 'badminton-rackets',
    query: 'badminton racket',
    must: 'badminton',
  },
  'Queen Bed with Memory Foam Mattress': {
    key: 'queen-bed',
    query: 'bed with mattress bedroom',
    must: 'bed',
  },
};

/**
 * Corrections found by reviewing the first fetch (Commons search is literal):
 * tighter `must` fragments where a loose one matched the wrong thing, and
 * broader fallback searches where the exact one found nothing.
 */
const OVERRIDES: Record<string, Partial<PhotoPlan>> = {
  'dell-xps-13': { must: 'dellxps' },
  // Commons has no usable photo for these (searches returned a museum sofa, a
  // tape-head cleaner, a 1940s poster): an empty query means "no photo" rather
  // than a wrong one.
  'cleaning-service': { query: '' },
  housekeeper: { query: '' },
  'sofa-set': { query: '' },
  // Judged wrong on review: a 2008 MacBook Air, a branded UK dealership, a
  // colonial villa for a modern duplex, a bridge for a land plot.
  'macbook-air-m3': { query: '' },
  'car-insurance': { query: '' },
  'villa-duplex': { query: '' },
  'land-sihanoukville': { query: '' },
  'toyota-corolla': {
    query: 'Toyota Corolla sedan',
    must: 'corolla',
    alts: [{ query: 'Toyota Corolla Altis', must: 'corolla' }],
  },
  'xiaomi-redmi-note-13-pro': {
    alts: [{ query: 'Redmi Note 13', must: 'redminote13' }],
  },
  'oneplus-oneplus-12': {
    alts: [{ query: 'OnePlus 12R', must: 'oneplus12' }],
  },
  'yamaha-exciter': {
    query: 'Yamaha Exciter 150',
    must: 'exciter',
    alts: [],
  },
  'accountant-office': { query: 'accounting calculator', must: 'calculator' },
  'hyundai-porter-truck': {
    alts: [{ query: 'Hyundai Porter', must: 'porter' }],
  },
  'tuk-tuk-cambodia': {
    alts: [
      { query: 'tuk-tuk Phnom Penh', must: 'tuk' },
      { query: 'tuk-tuk Siem Reap', must: 'tuk' },
    ],
  },
  'brake-pads': { alts: [{ query: 'brake pad', must: 'brake' }] },
  'truck-tires': {
    query: 'truck tyres',
    must: undefined,
    alts: [{ query: 'lorry tyre', must: 'tyre' }],
  },
  'lg-smart-tv': { alts: [{ query: 'LG television', must: 'lg' }] },
  mangoes: { alts: [{ query: 'mango', must: 'mango' }] },
  textbooks: {
    alts: [
      { query: 'textbooks', must: 'textbook' },
      { query: 'books pile', must: 'book' },
    ],
  },
};

/** Variant words that may be dropped to find a same-design sibling photo. */
const VARIANT_WORDS = new Set(['pro', 'max', 'ultra', 'plus', 'mini', 'se']);

export function photoPlanFor(demo: DemoListing): PhotoPlan {
  const plan = basePlanFor(demo);
  return { ...plan, ...OVERRIDES[plan.key] };
}

function basePlanFor(demo: DemoListing): PhotoPlan {
  if (demo.productModel) {
    const { brandSlug, modelName } = demo.productModel;
    const brand = String(demo.attributes.brand ?? brandSlug);
    // "Vivo V40" already names its brand; "Camry" does not.
    const named = (head: string) =>
      norm(head).startsWith(norm(brand)) ? head : `${brand} ${head}`;
    const words = modelName.split(' ');
    // Same-design fallbacks only: drop trailing variant words ("iPhone 16 Pro
    // Max" → "iPhone 16 Pro" → "iPhone 16"). Never fall back to the bare brand
    // or to another model number — that finds the wrong product.
    const alts: NonNullable<PhotoPlan['alts']> = [];
    for (let k = words.length - 1; k >= 1; k--) {
      if (!VARIANT_WORDS.has(words[k].toLowerCase())) break;
      const head = words.slice(0, k).join(' ');
      if (norm(head) !== norm(brand) && norm(head).length >= 3) {
        alts.push({ query: named(head), must: norm(head) });
      }
    }
    return {
      key: `${brandSlug}-${slug(modelName)}`,
      query: named(modelName),
      must: norm(modelName),
      alts,
    };
  }
  return OTHER_PHOTOS[demo.title] ?? { key: slug(demo.title), query: '' };
}
