import { inArray } from 'drizzle-orm';
import type { DbClient } from '../../db/drizzle.provider';
import {
  brands,
  brandSubcategoryLinks,
  models,
} from '../../db/schema/brands.schema';
import { subcategories } from '../../db/schema/categories.schema';

interface BrandSeed {
  slug: string;
  name: string;
  subcategories: string[];
  sortOrder: number;
}

/**
 * Starter models per brand slug. The spec never enumerates models (only
 * examples like "iPhone 12, Galaxy S21"), so this is a curated baseline of
 * common devices — admins add the rest via the Models admin page.
 * Keyed by brand slug; models are insert-only (never overwrite admin edits).
 */
const MODEL_SEEDS: Record<string, string[]> = {
  apple: [
    'iPhone 16 Pro Max',
    'iPhone 16 Pro',
    'iPhone 16 Plus',
    'iPhone 16',
    'iPhone 15 Pro Max',
    'iPhone 15 Pro',
    'iPhone 15 Plus',
    'iPhone 15',
    'iPhone 14 Pro Max',
    'iPhone 14 Pro',
    'iPhone 14',
    'iPhone 13 Pro Max',
    'iPhone 13 Pro',
    'iPhone 13',
    'iPhone 12 Pro Max',
    'iPhone 12 Pro',
    'iPhone 12',
    'iPhone SE (3rd gen)',
    'iPad Pro',
    'iPad Air',
    'iPad',
    'iPad mini',
    'MacBook Pro',
    'MacBook Air',
    'iMac',
    'Mac mini',
    'Apple Watch Ultra 2',
    'Apple Watch Series 9',
  ],
  samsung: [
    'Galaxy S25 Ultra',
    'Galaxy S25+',
    'Galaxy S25',
    'Galaxy S24 Ultra',
    'Galaxy S24+',
    'Galaxy S24',
    'Galaxy S23 Ultra',
    'Galaxy S23+',
    'Galaxy S23',
    'Galaxy S22 Ultra',
    'Galaxy S22+',
    'Galaxy S22',
    'Galaxy S21 Ultra',
    'Galaxy S21+',
    'Galaxy S21',
    'Galaxy Z Fold 6',
    'Galaxy Z Flip 6',
    'Galaxy A55',
    'Galaxy A35',
    'Galaxy A15',
    'Galaxy Tab S9',
    'Galaxy Tab S8',
    'Galaxy Watch 6',
  ],
  xiaomi: [
    'Xiaomi 15',
    'Xiaomi 14',
    'Xiaomi 14 Ultra',
    'Xiaomi 13',
    'Xiaomi 13T',
    'Xiaomi 12',
    'Redmi Note 13 Pro',
    'Redmi Note 13',
    'Redmi Note 12',
    'Redmi 13C',
    'Redmi 12',
    'Poco X6 Pro',
    'Poco X6',
    'Poco F5',
    'Xiaomi Pad 6',
    'Xiaomi Smart Band 8',
  ],
  huawei: [
    'Huawei Mate 60 Pro',
    'Huawei P60 Pro',
    'Huawei Nova 12',
    'Huawei MatePad 11',
  ],
  oppo: [
    'Oppo Find X8',
    'Oppo Find X7 Ultra',
    'Oppo Reno 12',
    'Oppo Reno 11',
    'Oppo A78',
  ],
  vivo: ['Vivo X200', 'Vivo X100', 'Vivo V40', 'Vivo V30', 'Vivo Y36'],
  nokia: ['Nokia X30', 'Nokia G42', 'Nokia C32'],
  motorola: [
    'Motorola Edge 50 Pro',
    'Motorola Edge 40',
    'Motorola G84',
    'Moto G54',
  ],
  oneplus: ['OnePlus 12', 'OnePlus 12R', 'OnePlus Nord 4', 'OnePlus 11'],
  google: ['Pixel 9 Pro', 'Pixel 9', 'Pixel 8a', 'Pixel 8', 'Pixel 7a'],
  realme: ['Realme 12 Pro+', 'Realme 12', 'Realme C67', 'Realme Narzo 70'],
  honor: ['Honor 200 Pro', 'Honor 200', 'Honor Magic6 Pro', 'Honor X8b'],
  tecno: ['Tecno Camon 30', 'Tecno Spark 20', 'Tecno Phantom V2'],
  infinix: ['Infinix Note 40', 'Infinix Hot 40', 'Infinix Zero 30'],
  sony: ['Xperia 1 V', 'Xperia 5 V', 'Xperia 10 V'],
  lg: ['LG G4', 'LG V60'],
  asus: ['ZenFone 11 Ultra', 'ZenFone 10', 'ROG Phone 8', 'ROG Phone 7'],
  alldocube: ['Alldocube iPlay 60', 'Alldocube iPlay 50'],
  blackview: ['Blackview BV9300', 'Blackview A90', 'Blackview Tab 16'],
  vertu: ['Vertu Signature', 'Vertu Aster P'],
  amazfit: ['Amazfit GTR 4', 'Amazfit Bip 5', 'Amazfit Band 7'],
  coros: ['COROS PACE 3', 'COROS VERTIX 2', 'COROS APEX 2'],
  fitbit: ['Fitbit Charge 6', 'Fitbit Versa 4', 'Fitbit Sense 2'],
  garmin: [
    'Garmin Forerunner 265',
    'Garmin Fenix 7',
    'Garmin Venu 3',
    'Garmin Instinct 2',
  ],
  kieslect: ['Kieslect K10 Pro', 'Kieslect K9'],
  dell: [
    'Dell XPS 15',
    'Dell XPS 13',
    'Dell Inspiron 15',
    'Dell Latitude 7440',
  ],
  hp: ['HP Spectre x360', 'HP Envy 16', 'HP Pavilion 15', 'HP EliteBook 840'],
  lenovo: [
    'Lenovo ThinkPad X1 Carbon',
    'Lenovo ThinkPad T14',
    'Lenovo IdeaPad 5',
    'Lenovo Legion 5',
  ],
  msi: ['MSI Katana 15', 'MSI Stealth 14', 'MSI Prestige 14', 'MSI Modern 14'],
  microsoft: [
    'Surface Laptop 6',
    'Surface Pro 10',
    'Surface Book 3',
    'Surface Go 4',
  ],
  toshiba: ['Toshiba Satellite Pro', 'Toshiba Portege X30'],
  fujitsu: ['Fujitsu Lifebook U7', 'Fujitsu Lifebook E5'],
  gateway: ['Gateway 15.6', 'Gateway 14.1'],
  averatec: ['Averatec N4500', 'Averatec N2300'],
  viewsonic: ['ViewSonic VA2432', 'ViewSonic VX2758'],
  aoc: ['AOC 24G2', 'AOC 27B2H', 'AOC U27V4'],
  canon: ['Canon EOS R50', 'Canon EOS 250D', 'Canon PIXMA TS3320'],
  epson: ['Epson EcoTank L3250', 'Epson WorkForce WF-110'],
  panasonic: ['Panasonic Toughbook 55', 'Panasonic Lumix GH6'],
  itronix: ['Itronix IX270', 'Itronix GD8000'],
  cardpressp: ['CardPresso CP150', 'CardPresso CP350'],
  evolvis: ['Evolis Primacy 2', 'Evolis Zenius'],
  hid: ['HID FARGO DTC4500e', 'HID FARGO DTC1250e'],
  inkanto: ['Inkanto X20', 'Inkanto S1'],
  kyocera: ['Kyocera Ecosys M2040', 'Kyocera TASKalfa 2020'],
  soppos: ['Soppos D-4500', 'Soppos F-3000'],
  zebra: ['Zebra ZD421', 'Zebra GC420', 'Zebra ZQ521'],
  brother: ['Brother DCP-L2550DW', 'Brother HL-L2460DW', 'Brother QL-820NWB'],
  hmd: ['HMD Fusion', 'HMD Skyline'],
  meizu: ['Meizu 21', 'Meizu 20'],
  redmi: ['Redmi Note 13 Pro', 'Redmi Note 13', 'Redmi 13C', 'Redmi A3'],
  poco: ['Poco X6 Pro', 'Poco X6', 'Poco F5'],
  zte: ['ZTE Blade V60', 'ZTE Axon 40'],
  blu: ['BLU Bold N1', 'BLU G91'],
  camfone: ['Camfone CF2024'],
  iqoo: ['iQOO 12', 'iQOO Z9', 'iQOO Neo9'],
  meitu: ['Meitu 8', 'Meitu V7'],
  myteb: ['MYTEB MT101', 'MYTEB MT2024'],
  philips: ['Philips 27E1N', 'Philips 242V8', 'Philips 32M1'],
  singtech: ['SingTech S100', 'SingTech S200'],
  htc: ['HTC U23 Pro', 'HTC Desire 22'],
  ulefone: ['Ulefone Armor 26', 'Ulefone Power Armor 18'],
  yealink: ['Yealink SIP-T31G', 'Yealink WH62'],
};

export const BRANDS: BrandSeed[] = [
  {
    slug: 'apple',
    name: 'Apple',
    subcategories: [
      'phones',
      'tablets',
      'smart-watches',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 0,
  },
  {
    slug: 'samsung',
    name: 'Samsung',
    subcategories: [
      'phones',
      'tablets',
      'smart-watches',
      'laptops',
      'desktops',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 1,
  },
  {
    slug: 'huawei',
    name: 'Huawei',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 2,
  },
  {
    slug: 'sony',
    name: 'Sony',
    subcategories: [
      'phones',
      'tablets',
      'laptops',
      'all-in-one',
      'printers-and-scanners',
    ],
    sortOrder: 3,
  },
  {
    slug: 'oppo',
    name: 'Oppo',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 4,
  },
  {
    slug: 'lg',
    name: 'LG',
    subcategories: ['phones', 'smart-watches', 'laptops', 'monitors'],
    sortOrder: 5,
  },
  {
    slug: 'vivo',
    name: 'Vivo',
    subcategories: ['phones', 'tablets'],
    sortOrder: 6,
  },
  { slug: 'nokia', name: 'Nokia', subcategories: ['phones'], sortOrder: 7 },
  {
    slug: 'meizu',
    name: 'Meizu',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 8,
  },
  {
    slug: 'oneplus',
    name: 'OnePlus',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 9,
  },
  {
    slug: 'blackberry',
    name: 'Blackberry',
    subcategories: ['phones'],
    sortOrder: 10,
  },
  {
    slug: 'htc',
    name: 'HTC',
    subcategories: ['phones', 'tablets'],
    sortOrder: 11,
  },
  {
    slug: 'acer',
    name: 'Acer',
    subcategories: [
      'phones',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 12,
  },
  {
    slug: 'google',
    name: 'Google',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 13,
  },
  {
    slug: 'xiaomi',
    name: 'Xiaomi',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 14,
  },
  {
    slug: 'motorola',
    name: 'Motorola',
    subcategories: ['phones'],
    sortOrder: 15,
  },
  {
    slug: 'alcatel',
    name: 'Alcatel',
    subcategories: ['phones', 'tablets'],
    sortOrder: 16,
  },
  {
    slug: 'philips',
    name: 'Philips',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 17,
  },
  {
    slug: 'singtech',
    name: 'SingTech',
    subcategories: ['phones', 'tablets', 'laptops'],
    sortOrder: 18,
  },
  { slug: 'blu', name: 'BLU', subcategories: ['phones'], sortOrder: 19 },
  {
    slug: 'zte',
    name: 'ZTE',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 20,
  },
  {
    slug: 'camfone',
    name: 'Camfone',
    subcategories: ['phones'],
    sortOrder: 21,
  },
  { slug: 'hmd', name: 'HMD', subcategories: ['phones'], sortOrder: 22 },
  { slug: 'honor', name: 'Honor', subcategories: ['phones'], sortOrder: 23 },
  {
    slug: 'infinix',
    name: 'Infinix',
    subcategories: ['phones'],
    sortOrder: 24,
  },
  { slug: 'iqoo', name: 'IQoo', subcategories: ['phones'], sortOrder: 25 },
  { slug: 'meitu', name: 'Meitu', subcategories: ['phones'], sortOrder: 26 },
  {
    slug: 'myteb',
    name: 'MYTEB',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 27,
  },
  { slug: 'poco', name: 'POCO', subcategories: ['phones'], sortOrder: 28 },
  { slug: 'realme', name: 'Realme', subcategories: ['phones'], sortOrder: 29 },
  { slug: 'redmi', name: 'Redmi', subcategories: ['phones'], sortOrder: 30 },
  { slug: 'tecno', name: 'Tecno', subcategories: ['phones'], sortOrder: 31 },
  {
    slug: 'ulefone',
    name: 'Ulefone',
    subcategories: ['phones'],
    sortOrder: 32,
  },
  {
    slug: 'yealink',
    name: 'Yealink',
    subcategories: ['phones'],
    sortOrder: 33,
  },
  {
    slug: 'alldocube',
    name: 'Alldocube',
    subcategories: ['tablets'],
    sortOrder: 34,
  },
  {
    slug: 'asus',
    name: 'ASUS',
    subcategories: [
      'tablets',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 35,
  },
  {
    slug: 'blackview',
    name: 'Blackview',
    subcategories: ['tablets'],
    sortOrder: 36,
  },
  {
    slug: 'vertu',
    name: 'Vertu',
    subcategories: ['smart-watches'],
    sortOrder: 37,
  },
  {
    slug: 'amazfit',
    name: 'Amazfit',
    subcategories: ['smart-watches'],
    sortOrder: 38,
  },
  {
    slug: 'coros',
    name: 'COROS',
    subcategories: ['smart-watches'],
    sortOrder: 39,
  },
  {
    slug: 'fitbit',
    name: 'Fitbit',
    subcategories: ['smart-watches'],
    sortOrder: 40,
  },
  {
    slug: 'garmin',
    name: 'Garmin',
    subcategories: ['smart-watches'],
    sortOrder: 41,
  },
  {
    slug: 'kieslect',
    name: 'Kieslect',
    subcategories: ['smart-watches'],
    sortOrder: 42,
  },
  {
    slug: 'dell',
    name: 'Dell',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 43,
  },
  {
    slug: 'hp',
    name: 'HP',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 44,
  },
  {
    slug: 'lenovo',
    name: 'Lenovo',
    subcategories: ['laptops', 'desktops', 'all-in-one', 'monitors'],
    sortOrder: 45,
  },
  {
    slug: 'msi',
    name: 'MSI',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 46,
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    subcategories: ['laptops', 'desktops', 'all-in-one', 'monitors'],
    sortOrder: 47,
  },
  {
    slug: 'toshiba',
    name: 'Toshiba',
    subcategories: ['laptops', 'all-in-one', 'printers-and-scanners'],
    sortOrder: 48,
  },
  {
    slug: 'fujitsu',
    name: 'Fujitsu',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 49,
  },
  {
    slug: 'gateway',
    name: 'Gateway',
    subcategories: ['laptops', 'desktops'],
    sortOrder: 50,
  },
  {
    slug: 'averatec',
    name: 'Averatec',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'printers-and-scanners',
    ],
    sortOrder: 51,
  },
  {
    slug: 'viewsonic',
    name: 'ViewSonic',
    subcategories: ['laptops', 'monitors'],
    sortOrder: 52,
  },
  {
    slug: 'aoc',
    name: 'AOC',
    subcategories: ['laptops', 'desktops', 'monitors'],
    sortOrder: 53,
  },
  {
    slug: 'canon',
    name: 'Canon',
    subcategories: ['laptops', 'monitors', 'printers-and-scanners'],
    sortOrder: 54,
  },
  {
    slug: 'epson',
    name: 'Epson',
    subcategories: ['laptops', 'all-in-one', 'printers-and-scanners'],
    sortOrder: 55,
  },
  {
    slug: 'panasonic',
    name: 'Panasonic',
    subcategories: ['laptops'],
    sortOrder: 56,
  },
  {
    slug: 'itronix',
    name: 'Itronix',
    subcategories: ['laptops'],
    sortOrder: 57,
  },
  {
    slug: 'cardpressp',
    name: 'Cardpressp',
    subcategories: ['printers-and-scanners'],
    sortOrder: 58,
  },
  {
    slug: 'evolis',
    name: 'Evolis',
    subcategories: ['printers-and-scanners'],
    sortOrder: 59,
  },
  {
    slug: 'hid',
    name: 'HID',
    subcategories: ['printers-and-scanners'],
    sortOrder: 60,
  },
  {
    slug: 'inkanto',
    name: 'Inkanto',
    subcategories: ['printers-and-scanners'],
    sortOrder: 61,
  },
  {
    slug: 'kyocera',
    name: 'Kyocera',
    subcategories: ['printers-and-scanners'],
    sortOrder: 62,
  },
  {
    slug: 'soppos',
    name: 'Soppos',
    subcategories: ['printers-and-scanners'],
    sortOrder: 63,
  },
  {
    slug: 'zebra',
    name: 'Zebra',
    subcategories: ['printers-and-scanners'],
    sortOrder: 64,
  },
  {
    slug: 'brother',
    name: 'Brother',
    subcategories: ['printers-and-scanners'],
    sortOrder: 65,
  },
  {
    slug: 'other',
    name: 'Other',
    subcategories: [
      'phones',
      'tablets',
      'smart-watches',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 999,
  },
];

export async function seedBrands(db: DbClient): Promise<void> {
  const slugs = [...new Set(BRANDS.flatMap((b) => b.subcategories))];
  const subRows = await db
    .select({ id: subcategories.id, slug: subcategories.slug })
    .from(subcategories)
    .where(inArray(subcategories.slug, slugs));
  const subSlugToId = new Map(subRows.map((r) => [r.slug, r.id]));

  for (const brand of BRANDS) {
    const [{ id: brandId }] = await db
      .insert(brands)
      .values({
        slug: brand.slug,
        name: brand.name,
        sortOrder: brand.sortOrder,
      })
      .onConflictDoUpdate({
        target: brands.slug,
        set: { name: brand.name, sortOrder: brand.sortOrder, isActive: true },
      })
      .returning({ id: brands.id });

    for (const subcategorySlug of brand.subcategories) {
      const subcategoryId = subSlugToId.get(subcategorySlug);
      if (!subcategoryId) continue;
      await db
        .insert(brandSubcategoryLinks)
        .values({ brandId, subcategoryId })
        .onConflictDoNothing();
    }
  }

  console.log(`  ✓ seeded ${BRANDS.length} brands`);
}

/**
 * Seed starter models (insert-only — admin-created models survive re-seeds).
 * The spec never enumerates models, so this is a curated baseline of common
 * devices per brand; admins add the rest via the Models admin page.
 */
export async function seedModels(db: DbClient): Promise<void> {
  const brandRows = await db
    .select({ id: brands.id, slug: brands.slug })
    .from(brands);
  const brandSlugToId = new Map(brandRows.map((r) => [r.slug, r.id]));

  let total = 0;
  for (const [brandSlug, modelNames] of Object.entries(MODEL_SEEDS)) {
    const brandId = brandSlugToId.get(brandSlug);
    if (!brandId) continue;
    for (let i = 0; i < modelNames.length; i++) {
      const name = modelNames[i].trim();
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await db
        .insert(models)
        .values({ brandId, slug, name, sortOrder: i })
        .onConflictDoNothing();
      total++;
    }
  }

  console.log(`  ✓ seeded ${total} models`);
}
