import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DbClient } from '../../db/drizzle.provider';
import { listings, listingPhotos } from '../../db/schema/listings.schema';
import { users, provinces, districts } from '../../db/schema/users.schema';
import { categories, subcategories } from '../../db/schema/categories.schema';

/**
 * Demo listings seed ("seed data properly for now", 2026-08-31): a curated
 * Khmer-market set spread across categories so the home feed + category/
 * subcategory feeds render real items. Attribute names match the seeded
 * brand/type rows (the feed filters on `attributes->>'brand'`/`bodyType`),
 * prices are USD, provinces are the seeded geography. Idempotent: rows are
 * inserted only when the title does not exist yet; the pre-existing E2E/test
 * junk rows are removed.
 */

interface DemoListing {
  title: string;
  description: string;
  price: string;
  discountValue?: string;
  condition: 'new' | 'used';
  category: string;
  subcategory: string;
  province?: string;
  district?: string;
  location?: string;
  address?: string;
  deliveryFree?: boolean;
  contactName?: string;
  contactPhones?: string[];
  attributes: Record<string, string>;
  photos?: { url: string; path: string }[]; // local design assets (interim)
}

const DEMO_LISTINGS: DemoListing[] = [
  {
    title: 'Toyota Camry 2019 Full Option',
    description:
      'Full option Camry, single owner, well maintained with full service history. Free delivery within Phnom Penh.',
    price: '14950',
    discountValue: '1200',
    condition: 'used',
    category: 'cars-and-vehicles',
    subcategory: 'cars-for-sale',
    province: 'phnom-penh',
    location: 'Toul Kork',
    address: 'Phnom Penh',
    deliveryFree: true,
    contactName: 'Sok Dara',
    contactPhones: ['+85516767001'],
    attributes: {
      year: '2019',
      brand: 'Toyota',
      model: 'Camry',
      bodyType: 'Sedan',
      color: 'Silver',
      engineType: 'Petrol',
      transmission: 'Auto',
      taxType: 'Plate Number',
    },
    photos: [
      {
        url: '/sub-img/car_vehicles/cars-for-sale/body_type/sedan.png',
        path: 'demo/camry-1.png',
      },
    ],
  },
  {
    title: 'MG ZS 2022 Low Mileage',
    description:
      'MG ZS 2022, under 20,000 km, still under warranty. Showroom condition.',
    price: '11500',
    condition: 'used',
    category: 'cars-and-vehicles',
    subcategory: 'cars-for-sale',
    province: 'siem-reap',
    location: 'Svay Dangkum',
    contactName: 'Amsom',
    contactPhones: ['+85592767002'],
    attributes: {
      year: '2022',
      brand: 'MG',
      model: 'ZS',
      bodyType: 'SUV',
      color: 'White',
      engineType: 'Petrol',
      transmission: 'Auto',
      taxType: 'Plate Number',
    },
    photos: [
      {
        url: '/sub-img/car_vehicles/cars-for-sale/body_type/suv.png',
        path: 'demo/mg-zs-1.png',
      },
    ],
  },
  {
    title: 'Lexus RX 350 2021 Luxury',
    description:
      'Luxury SUV, leather interior, full option. Serious buyers only.',
    price: '38000',
    condition: 'used',
    category: 'cars-and-vehicles',
    subcategory: 'cars-for-sale',
    province: 'phnom-penh',
    location: 'Boeung Keng Kang',
    contactName: 'Mony',
    contactPhones: ['+85512767003'],
    attributes: {
      year: '2021',
      brand: 'Lexus',
      model: 'RX 350',
      bodyType: 'SUV',
      color: 'Black',
      engineType: 'Petrol',
      transmission: 'Auto',
      taxType: 'Plate Number',
    },
  },
  {
    title: 'Honda Civic 2018 One Owner',
    description: 'One-owner Civic, accident-free, owner moving abroad.',
    price: '12800',
    condition: 'used',
    category: 'cars-and-vehicles',
    subcategory: 'cars-for-sale',
    province: 'battambang',
    location: 'Battambang City',
    contactName: 'Chan',
    contactPhones: ['+85596767004'],
    attributes: {
      year: '2018',
      brand: 'Honda',
      model: 'Civic',
      bodyType: 'Sedan',
      color: 'Gray',
      engineType: 'Petrol',
      transmission: 'Auto',
      taxType: 'Plate Number',
    },
  },
  {
    title: 'Honda Dream 125 2023',
    description:
      'Honda Dream 2023, low mileage, excellent condition. Great daily commuter.',
    price: '1150',
    condition: 'used',
    category: 'cars-and-vehicles',
    subcategory: 'motorcycles-for-sale',
    province: 'siem-reap',
    contactName: 'Pisey',
    contactPhones: ['+85511767005'],
    attributes: {
      year: '2023',
      brand: 'Honda',
      model: 'Dream 125',
      color: 'Black',
    },
    photos: [
      {
        url: '/sub-img/car_vehicles/vehicles-for-rent/body_type/motorcycle.png',
        path: 'demo/dream-1.png',
      },
    ],
  },
  {
    title: 'Yamaha Exciter 150 2024',
    description: 'Brand new Exciter 150, ready to register.',
    price: '2050',
    condition: 'new',
    category: 'cars-and-vehicles',
    subcategory: 'motorcycles-for-sale',
    province: 'phnom-penh',
    contactName: 'Virak',
    contactPhones: ['+85513767006'],
    attributes: {
      year: '2024',
      brand: 'Yamaha',
      model: 'Exciter 150',
      color: 'Blue',
    },
  },
  {
    title: 'iPhone 16 Pro Max 256GB',
    description: 'Sealed, brand new iPhone 16 Pro Max 256GB, free delivery.',
    price: '1299',
    discountValue: '60',
    condition: 'new',
    category: 'phones-and-tablets',
    subcategory: 'phones',
    province: 'phnom-penh',
    deliveryFree: true,
    contactName: 'Dara',
    contactPhones: ['+85516767007'],
    attributes: {
      brand: 'Apple',
      model: 'iPhone 16 Pro Max',
      storage: '256 GB',
      color: 'Natural Titanium',
    },
    photos: [
      {
        url: '/sub-img/phones-tablets/phones/brands/apple.png',
        path: 'demo/iphone-1.png',
      },
    ],
  },
  {
    title: 'Samsung Galaxy S25 Ultra 512GB',
    description: 'Samsung Galaxy S25 Ultra 512GB, sealed box.',
    price: '1150',
    condition: 'new',
    category: 'phones-and-tablets',
    subcategory: 'phones',
    province: 'battambang',
    contactName: 'Srey',
    contactPhones: ['+85599767008'],
    attributes: {
      brand: 'Samsung',
      model: 'Galaxy S25 Ultra',
      storage: '512 GB',
      color: 'Titanium Black',
    },
  },
  {
    title: 'MacBook Air M3 13-inch 2024',
    description: 'MacBook Air M3, 8GB RAM, 256GB SSD, official warranty.',
    price: '1050',
    condition: 'new',
    category: 'computers-and-accessories',
    subcategory: 'laptops',
    province: 'phnom-penh',
    contactName: 'Romdoul',
    contactPhones: ['+85512767009'],
    attributes: {
      brand: 'Apple',
      model: 'MacBook Air M3',
      storage: '256 GB',
      ram: '8 GB',
    },
  },
  {
    title: 'LG 65-inch 4K Smart TV',
    description: '65-inch LG 4K smart TV, new in box, free installation.',
    price: '590',
    discountValue: '40',
    condition: 'new',
    category: 'electronics-and-appliances',
    subcategory: 'tvs-videos-and-audio',
    province: 'phnom-penh',
    deliveryFree: true,
    contactName: 'Kolap',
    contactPhones: ['+85516767010'],
    attributes: {
      type: 'TV',
      brand: 'LG',
    },
  },
  {
    title: 'Brand New Villa Duplex for Sale',
    description:
      'New duplex villa in a quiet residential area, 4 bedrooms, 5 bathrooms, facing south.',
    price: '245000',
    condition: 'new',
    category: 'home-and-land',
    subcategory: 'house-for-sale',
    province: 'siem-reap',
    district: 'svay-dangkum',
    location: 'Siem Reap',
    address: 'Kok Chok, Svay Dangkum',
    contactName: 'Chanthy',
    contactPhones: ['+85511767011'],
    attributes: {
      type: 'Villa',
      bedrooms: '4',
      bathrooms: '5',
      facing: 'South',
    },
  },
  {
    title: 'Land For Sale - Sihanoukville 600m²',
    description:
      'Prime residential land near the beach road, title deed available.',
    price: '38000',
    condition: 'used',
    category: 'home-and-land',
    subcategory: 'land-for-sale',
    province: 'sihanoukville',
    location: 'Sihanoukville',
    address: 'Beach Road, Sihanoukville',
    contactName: 'Phanith',
    contactPhones: ['+85592767012'],
    attributes: {},
  },
  {
    title: 'New Sofa Set - 3 Seater + Armchair',
    description:
      'Modern fabric sofa set, 3 seater plus armchair, free delivery.',
    price: '380',
    deliveryFree: true,
    condition: 'new',
    category: 'furniture-and-decor',
    subcategory: 'chairs-and-sofas',
    province: 'phnom-penh',
    location: 'Phnom Penh',
    contactName: 'Malisa',
    contactPhones: ['+85513767013'],
    attributes: {
      type: 'Sofa',
    },
  },
  {
    title: "Men's Polo Shirt - New Arrival",
    description: 'New arrival polo shirts, all sizes, wholesale welcome.',
    price: '12',
    condition: 'new',
    category: 'fashion-and-beauty',
    subcategory: 'mens-fashion',
    province: 'battambang',
    contactName: 'Sophea',
    contactPhones: ['+85599767014'],
    attributes: {
      type: 'Men Clothing',
    },
  },
  {
    title: 'Accountant wanted - Phnom Penh',
    description:
      'Medium-size company seeking an experienced accountant, full-time.',
    price: '500',
    condition: 'used',
    category: 'jobs',
    subcategory: 'accounting-jobs',
    province: 'phnom-penh',
    location: 'Daun Penh',
    contactName: 'HR Department',
    contactPhones: ['+85512767015'],
    attributes: {
      jobType: 'Full-time',
      experience: '2Year+',
    },
  },
];

const JUNK_TITLES = [
  'car',
  'car 1',
  'car 2',
  'car 3',
  'E2E Corolla 2024 - browser test',
  'Smoke Test Corolla 2023',
];

export async function seedListings(db: DbClient): Promise<void> {
  // Remove the pre-existing test/E2E junk rows (their photos cascade).
  const removed = await db
    .delete(listings)
    .where(inArray(listings.title, JUNK_TITLES))
    .returning({ id: listings.id });
  if (removed.length > 0) {
    console.log(`  ✓ removed ${removed.length} test junk listings`);
  }

  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
    .limit(1);
  if (!adminUser) {
    console.log('  ✗ skipped listings seed (no admin user yet)');
    return;
  }

  const [cats, subs, provs, dists] = await Promise.all([
    db.select({ id: categories.id, slug: categories.slug }).from(categories),
    db
      .select({ id: subcategories.id, slug: subcategories.slug })
      .from(subcategories),
    db.select({ id: provinces.id, slug: provinces.slug }).from(provinces),
    db.select({ id: districts.id, slug: districts.slug }).from(districts),
  ]);
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const subBySlug = new Map(subs.map((s) => [s.slug, s.id]));
  const provBySlug = new Map(provs.map((p) => [p.slug, p.id]));
  const distBySlug = new Map(dists.map((d) => [d.slug, d.id]));

  let inserted = 0;
  for (const demo of DEMO_LISTINGS) {
    const [existing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.title, demo.title))
      .limit(1);
    if (existing) continue; // idempotent by title

    const categoryId = catBySlug.get(demo.category);
    const subcategoryId = subBySlug.get(demo.subcategory);
    if (!categoryId || !subcategoryId) {
      console.warn(
        `  ✗ skipped "${demo.title}" (missing category/subcategory)`,
      );
      continue;
    }

    const [row] = await db
      .insert(listings)
      .values({
        userId: adminUser.id,
        categoryId,
        subcategoryId,
        title: demo.title,
        description: demo.description,
        price: demo.price,
        discountValue: demo.discountValue,
        discountType: demo.discountValue ? 'amount' : undefined,
        currency: 'USD',
        condition: demo.condition,
        attributes: demo.attributes,
        provinceId: demo.province ? provBySlug.get(demo.province) : undefined,
        districtId: demo.district ? distBySlug.get(demo.district) : undefined,
        location: demo.location,
        address: demo.address,
        deliveryFree: demo.deliveryFree ?? false,
        contactName: demo.contactName,
        contactPhones: demo.contactPhones ?? [],
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: listings.id });

    if (demo.photos?.length) {
      await db.insert(listingPhotos).values(
        demo.photos.map((p, i) => ({
          listingId: row.id,
          url: p.url,
          path: p.path,
          sort: i,
        })),
      );
    }
    inserted++;
  }
  console.log(`  ✓ seeded ${inserted} demo listings`);
}
