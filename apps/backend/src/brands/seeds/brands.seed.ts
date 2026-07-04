import { inArray } from 'drizzle-orm';
import type { DbClient } from '../../db/drizzle.provider';
import { brands, brandSubcategoryLinks } from '../../db/schema/brands.schema';
import { subcategories } from '../../db/schema/categories.schema';

interface BrandSeed {
  slug: string;
  name: string;
  subcategories: string[];
  sortOrder: number;
}

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
