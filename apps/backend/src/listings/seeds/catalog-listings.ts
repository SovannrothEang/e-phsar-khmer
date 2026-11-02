import { CAR_CATALOG, PHONE_CATALOG } from '../../products/seeds/catalog';
import { DEMO_PEOPLE, demoPhone } from './demo-people';
import type { DemoListing } from './listings.seed';

/**
 * ~100 demo listings (2026-11-01): cars and phones built from the spec-page
 * catalogue (each links to its trusted `product_specs` page), plus a small
 * spread of other categories. Titles are unique — the seed is idempotent by
 * title.
 */

/** Owner fields for DEMO_PEOPLE[i]: the ad carries that person's own contact. */
const owned = (i: number) => {
  const person = DEMO_PEOPLE[i];
  return {
    ownerIndex: i,
    contactName: `${person.firstName} ${person.lastName}`,
    contactPhones: [demoPhone(i)],
    province: person.province,
    location: person.location,
  };
};

const km = (n: number) => n.toLocaleString('en-US');

/** Sellers carrying the catalogue (48 cars ÷ 2 per seller). */
const SELLER_COUNT = 24;

function carListings(): DemoListing[] {
  let i = 0;
  return CAR_CATALOG.flatMap((car) =>
    car.variants.map((v): DemoListing => {
      const idx = i++;
      const isNew = v.condition === 'new';
      return {
        title: `${car.brandName} ${car.modelName} ${v.year} ${v.trim} - ${v.color}`,
        description: isNew
          ? `Brand new ${v.year} ${car.brandName} ${car.modelName} ${v.trim} in ${v.color}. Official warranty, test drive available.`
          : `${v.year} ${car.brandName} ${car.modelName} ${v.trim}, ${v.color}, ${km(v.mileageKm)} km. ${
              idx % 2 === 0
                ? 'Full service history, accident-free.'
                : 'Well maintained, clean interior, ready to drive.'
            }`,
        price: String(v.price),
        condition: v.condition,
        category: 'cars-and-vehicles',
        subcategory: 'cars-for-sale',
        deliveryFree: idx % 5 === 0,
        // 2 cars per seller — the free plan's cars-for-sale cap.
        ...owned(Math.floor(idx / 2)),
        attributes: {
          year: String(v.year),
          brand: car.brandName,
          model: car.modelName,
          bodyType: car.bodyType,
          color: v.color,
          engineType: car.engineType,
          transmission: car.transmission,
          taxType: v.taxType,
        },
        productModel: { brandSlug: car.brandSlug, modelName: car.modelName },
      };
    }),
  );
}

function phoneListings(): DemoListing[] {
  let i = 50;
  return PHONE_CATALOG.flatMap((phone) =>
    phone.variants.map((v): DemoListing => {
      const idx = i++;
      const isNew = v.condition === 'new';
      return {
        title: `${phone.modelName} ${v.storage} - ${v.color}`,
        description: isNew
          ? `${phone.modelName} ${v.storage} in ${v.color}, brand new sealed box with shop warranty. Free delivery in Phnom Penh.`
          : `${phone.modelName} ${v.storage} in ${v.color}. ${v.note ?? 'Excellent condition.'} Open to inspection.`,
        price: String(v.price),
        condition: v.condition,
        category: 'phones-and-tablets',
        subcategory: 'phones',
        deliveryFree: isNew || idx % 3 === 0,
        // Round-robin over the 24 sellers: at most 2 phones each.
        ...owned((idx - 50) % SELLER_COUNT),
        attributes: {
          brand: phone.brandName,
          model: phone.modelName,
          storage: v.storage,
          color: v.color,
        },
        productModel: {
          brandSlug: phone.brandSlug,
          modelName: phone.modelName,
        },
      };
    }),
  );
}

/** A small spread across the other families (no spec page). */
function otherListings(): DemoListing[] {
  const base: Omit<
    DemoListing,
    'contactName' | 'contactPhones' | 'province' | 'location'
  >[] = [
    {
      title: 'iPad Air 11-inch M2 128GB Wi-Fi',
      description: 'iPad Air M2, 128GB, sealed box, official warranty.',
      price: '640',
      condition: 'new',
      category: 'phones-and-tablets',
      subcategory: 'tablets',
      attributes: { brand: 'Apple', model: 'iPad Air', storage: '128 GB' },
    },
    {
      title: 'Samsung Galaxy Tab S9 256GB',
      description: 'Tab S9 with S Pen, 6 months used, with keyboard case.',
      price: '520',
      condition: 'used',
      category: 'phones-and-tablets',
      subcategory: 'tablets',
      attributes: {
        brand: 'Samsung',
        model: 'Galaxy Tab S9',
        storage: '256 GB',
      },
    },
    {
      title: 'Apple Watch Series 9 45mm GPS',
      description: 'Apple Watch Series 9, midnight aluminium, full box.',
      price: '330',
      condition: 'used',
      category: 'phones-and-tablets',
      subcategory: 'smart-watches',
      attributes: { brand: 'Apple', model: 'Apple Watch Series 9' },
    },
    {
      title: 'Lenovo ThinkPad T14 Gen 3 - i7 16GB',
      description: 'ThinkPad T14, Core i7, 16GB RAM, 512GB SSD, great battery.',
      price: '690',
      condition: 'used',
      category: 'computers-and-accessories',
      subcategory: 'laptops',
      attributes: {
        brand: 'Lenovo',
        model: 'ThinkPad T14',
        storage: '512 GB',
        ram: '16 GB',
      },
    },
    {
      title: 'Dell XPS 13 9315 - i5 8GB',
      description: 'Dell XPS 13, light and fast, perfect for office work.',
      price: '540',
      condition: 'used',
      category: 'computers-and-accessories',
      subcategory: 'laptops',
      attributes: {
        brand: 'Dell',
        model: 'XPS 13',
        storage: '256 GB',
        ram: '8 GB',
      },
    },
    {
      title: 'Samsung 55-inch Crystal UHD 4K TV',
      description:
        '55-inch Crystal UHD smart TV, new in box, free installation.',
      price: '460',
      condition: 'new',
      category: 'electronics-and-appliances',
      subcategory: 'tvs-videos-and-audio',
      attributes: { type: 'TV', brand: 'Samsung' },
    },
    {
      title: 'Honda Scoopy 2023 - Cream',
      description: 'Honda Scoopy 2023, low mileage, one owner, plate number.',
      price: '1980',
      condition: 'used',
      category: 'cars-and-vehicles',
      subcategory: 'motorcycles-for-sale',
      attributes: {
        year: '2023',
        brand: 'Honda',
        model: 'Scoopy',
        taxType: 'Plate Number',
        color: 'Cream',
      },
    },
    {
      title: 'Yamaha NMAX 155 2022 - Gray',
      description: 'Yamaha NMAX 155 ABS, well kept, tax paper complete.',
      price: '2350',
      condition: 'used',
      category: 'cars-and-vehicles',
      subcategory: 'motorcycles-for-sale',
      attributes: {
        year: '2022',
        brand: 'Yamaha',
        model: 'NMAX',
        taxType: 'Tax Paper',
        color: 'Gray',
      },
    },
    {
      title: 'Poodle Puppies - 2 Months, Vaccinated',
      description: 'Healthy toy poodle puppies, first vaccines done.',
      price: '250',
      category: 'pets',
      subcategory: 'dogs',
      attributes: {},
    },
    {
      title: 'Persian Kitten - Blue Eyes',
      description: 'Friendly Persian kitten, litter trained, 3 months old.',
      price: '180',
      category: 'pets',
      subcategory: 'cats',
      attributes: {},
    },
    {
      title: 'Fresh Battambang Mangoes - 10kg Box',
      description:
        'Sweet Keo Romeat mangoes picked this week, delivery available.',
      price: '18',
      category: 'foods',
      subcategory: 'fruits',
      attributes: {},
    },
    {
      title: 'Phka Rumduol Fragrant Rice - 25kg',
      description: 'Premium Phka Rumduol rice, new harvest, wholesale welcome.',
      price: '32',
      category: 'foods',
      subcategory: 'rice-and-cereal',
      attributes: {},
    },
    {
      title: 'Home & Office Cleaning Service',
      description:
        'Experienced cleaners for homes, offices and move-out cleaning.',
      category: 'services',
      subcategory: 'cleaning-and-maid-services',
      attributes: {},
    },
    {
      title: 'Housekeeper / Maid Wanted - Phnom Penh',
      description:
        'Family seeking a full-time housekeeper, accommodation provided.',
      price: '250',
      category: 'jobs',
      subcategory: 'cleaner-maid',
      attributes: { jobType: 'Full-time', experience: '2 Years+' },
    },
    {
      title: 'University Textbooks Bundle - Business & IT',
      description: 'Used textbooks in good condition, 12 titles together.',
      price: '45',
      category: 'books-sports-and-hobbies',
      subcategory: 'books',
      attributes: {},
    },
    {
      title: 'Yonex Badminton Racket Set (2 Rackets)',
      description: 'Two Yonex rackets with bag and shuttlecocks, barely used.',
      price: '60',
      category: 'books-sports-and-hobbies',
      subcategory: 'sports-equipment',
      attributes: {},
    },
    {
      title: 'Queen Bed with Memory Foam Mattress',
      description:
        'Solid wood queen bed frame with a new memory foam mattress.',
      price: '420',
      category: 'furniture-and-decor',
      subcategory: 'beds-and-mattresses',
      attributes: {},
    },
  ];
  // One per seller, offset past the first sellers' car pairs: with 2 cars and
  // up to 2 phones each, a seller never exceeds the free plan's 5 live ads.
  return base.map((b, n) => ({
    ...b,
    ...owned((n + 5) % SELLER_COUNT),
  }));
}

export function buildCatalogListings(): DemoListing[] {
  return [...carListings(), ...phoneListings(), ...otherListings()];
}
