/**
 * Subcategories on the real listing form (`ListingPostForm`), which renders
 * exactly the fields the subcategory's own `field_schema` declares. Everything
 * else still falls through to the mock `DynamicForm` below, whose submit is
 * deliberately unwired — so this list is an explicit opt-in, not a guess.
 */
export const REAL_FORM_SUBCATEGORIES = [
  "cars-for-sale",
  "bicycles",
  "motorcycles-for-sale",
  "vehicles-for-rent",
  "maintenance-and-repair",
  "lorries-vans-and-tractors",
  "financing-and-insurance",
  "tuk-tuk-and-remork",
  "parts-and-accessories",
  "vehicles-others",
  // Phones & Tablets — opted in 2026-09-22 once the `storage`, `accessory`
  // and `network` blocks existed (they were the family's only unrenderable
  // keys; a key with no block vanishes silently).
  "phones",
  "tablets",
  "smart-watches",
  "phone-accessories",
  "phone-numbers",
  // Computers & Accessories — opted in 2026-09-22 once the `screenSize`,
  // `ram`, `cpu`, `vga` and `type` blocks existed (the family's only
  // unrenderable keys; a key with no block vanishes silently). Note the parts
  // subcategory's slug is `computers-parts-and-accessories` — the cars family
  // already owns the bare `parts-and-accessories`.
  "laptops",
  "desktops",
  "all-in-one",
  "monitors",
  "printers-and-scanners",
  "computers-parts-and-accessories",
  "softwares",
  // Electronics & Appliances — opted in 2026-09-22. No new block was needed:
  // the family's 13 keys (photos/title/type/condition/price/discount/
  // description/location/address/deliveryFree/contact trio) are all already
  // renderable, `type` by the same block the computers parts form uses.
  // All 12 declare Condition (captain, 2026-09-22) — spec-detail-four.md
  // omits it on machinery/security-cameras/lighting, but the captain's mock
  // groups those with the Fridges & Freezers form, so the seed and the
  // ListingSpecs condition list both carry it.
  "washing-machines-and-dryers",
  "fridges-and-freezers",
  "air-conditioning-and-heating",
  "tools",
  "machinery",
  "consumer-electronics",
  "security-cameras",
  "lighting",
  "cameras-and-camcorders",
  "tvs-videos-and-audio",
  "home-appliances",
  "video-games-consoles-toys",
  // Home & Land — opted in 2026-09-22 once the `bedroom`, `bathroom`, `facing`
  // and `size` blocks existed (the family's only unrenderable keys; a key with
  // no block vanishes silently). The property cluster renders above the
  // identity cluster so Type lands after Size, per the captain's mock. Note
  // `facing` was dropped from apartment-for-rent in the seed the same day
  // (mock wins over spec-detail-five.md, which listed it) — the block simply
  // does not render for a subcategory that does not declare it.
  "house-for-sale",
  "house-for-rent",
  "condo-for-sale",
  "apartment-for-rent",
  // The rest of Home & Land — opted in 2026-09-23. **No new block was needed
  // this time**: every key these eight declare (`size`, `type`, `price`,
  // `description`, `location`, `address`, the contact trio) already had a
  // render block, because the property cluster added for the four above
  // (2026-09-22) covered `size` and the `type` block already existed for the
  // computers/electronics forms. Three of them — properties-wanted,
  // agent-services and home-and-land-others — declare **no `size` and no
  // `price`**, which the schema gating handles on its own: the Price block is
  // skipped at render, at validation and in the payload, and `listings.price`
  // is nullable.
  "land-for-sale",
  "land-for-rent",
  "commercial-properties-for-sale",
  "commercial-properties-for-rent",
  "room-for-rent",
  "properties-wanted",
  "agent-services",
  "home-and-land-others",
  // Jobs — all 36 subcategories, opted in 2026-09-23. They share one form
  // (spec-detail-six.md: "they have the same form"), which needed three new
  // blocks: `jobType`, `experience` and `company`. The first two are pickers
  // whose lists come from the admin-managed `jobtypes` set and the (global)
  // `experiences` set; `company` is a plain text field. The job-type key was
  // ALSO renamed from `type` to `jobType` in the seed the same day — `type`
  // maps to the `types` set, whose rows are ticked for computers/property and
  // for no jobs subcategory at all, so the picker resolved to an empty list on
  // a starred field; `jobType` is what `SET_FIELD_KEYS`, `ListingSpecs` and
  // the `jobtypes` admin page already expected.
  "accounting-jobs",
  "administration",
  "architecture-engineering",
  "assistant-secretary",
  "audit-taxation",
  "banking-insurance",
  "cashier-receptionist",
  "catering-restaurant",
  "cleaner-maid",
  "consultancy",
  "customer-service",
  "design",
  "education-training",
  "finance",
  "freight-shipping-delivery-warehouse",
  "hotel-hospitality",
  "human-resources",
  "information-technology",
  "lawyer-legal-services",
  "management",
  "manufacturing",
  "marketing",
  "media-advertising",
  "medical-health-nursing",
  "merchandising-purchasing",
  "operations",
  "project-management",
  "quality-control",
  "resort-casino",
  "sales",
  "security-driver",
  "technicians",
  "telecommunications",
  "translations-interpretation",
  "travel-agents-ticket-sales",
  "jobs-others",
  // Services — all 24 subcategories, opted in 2026-09-27. **No new block was
  // needed**: the family's 8 keys (photos max 8 / title / description /
  // location / address / the contact trio) are every one already renderable —
  // `contactEmail` was the only one that could have vanished silently, and its
  // block is there. spec-detail-seven.md (13 lines — "they have the same
  // form") and the seed agree field-for-field, so unlike Jobs there was no
  // rename or divergence to resolve. The family declares **no price**: these
  // listings publish with a NULL price and read "Negotiable" on the cards and
  // the detail page, exactly like the three Home & Land forms that declare
  // none. The deleted `lib/post-ad.ts` mock carried a `company_name` payload
  // field, but that was the mock's generic boilerplate — 146 occurrences
  // against 145 mock subcategory entries, i.e. one per subcategory of every
  // category, Jobs and Cars included — never Services design intent.
  "accounting-services",
  "financial-services",
  "travel-and-tourism",
  "automotive-services",
  "advertising-and-media",
  "bridal-services",
  "cleaning-and-maid-services",
  "construction-arch-and-interiors",
  "education-training-services",
  "engineering-services",
  "insurance-services",
  "massage-and-spa",
  "hospitality-travel-and-tourism",
  "health-medical-and-pharma",
  "it-and-telecom",
  "interior-design-and-renovation",
  "legal-services",
  "movers-and-logistics",
  "plumbing-and-electrical",
  "property-and-real-estate",
  "science-services",
  "supply-chain-and-logistics",
  "printing-and-publishing",
  "other-services",
  // Fashion & Beauty — all 6 subcategories, opted in 2026-09-27. Five of the
  // six declare `type` (the same block the computers/electronics/property forms
  // use), so most of this family is the usual schema-gated opt-in.
  //
  // Two things made it NOT a copy-paste of Services:
  //  1. `fashion-accessories`' picker reuses the **`accessory`** block — the
  //     same key and the same `accessories` set Phone Accessories reads — and
  //     only its LABEL differs: its own `field_schema` says **"Accessory Type"**
  //     (captain, 2026-09-27), which the block already picks up from
  //     `config.labels`. So no new block was needed for it either. What the key
  //     must NOT be is `type` (→ `types`): NO `types` row is ticked for this
  //     subcategory and `types` is managed, so it would have rendered an EMPTY
  //     picker on a starred field — the same unpublishable-form trap Jobs hit
  //     with `jobType`.
  //     (A separate `fashion_accessories` set, keyed `accessoryType`, was built
  //     the same day and reverted — captain's call to keep ONE set. See the
  //     `accessories` block in attributes.seed.ts before re-proposing it.)
  //  2. `beauty-and-healthcare-products` declares **no type at all** — the
  //     family's one form without it, per the captain and spec-detail-eight.
  //     Nothing special handles that: the schema gating simply skips the block.
  // Also note the type lists are admin-managed data, not seed literals —
  // spec-detail-eight spells the men's/kids options "Men's Accessories" and
  // "Baby & Kids Clothing" while the `types` set (and the design mock data in
  // the since-deleted `lib/post-ad.ts`) say "Men Accessories"/"Kid Clothing".
  // The design mock agrees with the ticked rows, so the rows stand and the
  // spec-detail wording loses — the same mock-wins rule as apartment-for-rent's
  // dropped `facing`.
  "womens-fashion",
  "mens-fashion",
  "baby-and-kids",
  "travel-and-luggage",
  "fashion-accessories",
  "beauty-and-healthcare-products",
  // Furniture & Decor — all 10 subcategories, opted in 2026-09-27.
  //
  // Like the 2026-09-23 Home & Land batch and Services, this one needed **no
  // new block and no new code at all**: every key the family declares — photos
  // / title / price / discount / description / location / address /
  // deliveryFree / the contact trio, plus `type` on two of them — already had a
  // render block, so the ship is the slug list alone.
  //
  // **Only `table-and-desks` and `chairs-and-sofas` declare `type`** (captain's
  // mock, matching spec-detail-nine.md); the other 8 are the same 11-field form
  // with no Type at all. `wardrobe-and-cabinets` and the seven below it are
  // therefore the no-Type shape, not the Type one — do not add a `type` key to
  // them: `types` is a managed set and no row is ticked for those eight, so a
  // Type field there would render an EMPTY picker (and, starred, make the form
  // unpublishable — the Jobs `jobType` trap).
  //
  // Where Type DOES render, its options come from the admin-managed `types`
  // rows ticked for that subcategory, not from the schema's inline `options`:
  // the rows (and the design mock data in the since-deleted `lib/post-ad.ts`)
  // read "Dining Table"
  // / "Kids Desks" / "Kids Chairs&Seats" while spec-detail-nine.md spells them
  // "Dining Tables" / "Kid's Desks" / "Kid's Chair & Seats". The rows agree
  // with the design, so the rows stand and the spec wording loses — the same
  // mock-wins rule as apartment-for-rent's dropped `facing` and the Fashion &
  // Beauty type lists.
  "table-and-desks",
  "chairs-and-sofas",
  "wardrobe-and-cabinets",
  "shelves-and-drawers",
  "beds-and-mattresses",
  "curtains-and-carpets",
  "other-furniture",
  "kitchenware",
  "household-items",
  "handicrafts-paintings",
  // Books, Sports & Hobbies — all 7 subcategories, opted in 2026-09-27.
  //
  // The slug list is the whole ship again — every key this family declares
  // already had a render block, so no new code was needed. What makes it worth
  // a comment is that it is the catalogue's **mixed** family, and the only one
  // where both shapes sit inside a single category: per spec-detail-ten.md,
  // `musical-instruments` is the Type+Condition form (13 keys) while the six
  // below it share the plain 11-field form with neither. The schema gating does
  // all of that work, so nothing here needs a per-subcategory exception — but
  // **do not add `type` or `condition` to the six**: `types` is a managed set
  // with no row ticked for any of them and no inline fallback, so a Type field
  // there would render an EMPTY picker (and, starred, make the form
  // unpublishable — the Jobs `jobType` trap), while a Condition field would put
  // a row on their detail pages that their forms can never fill.
  //
  // `musical-instruments`' Type options come from the admin-managed `types`
  // rows ticked for it (11: the spec's 10 + the shared `other`), not from the
  // schema's inline `options` — and the two disagree on one name: the row reads
  // **"Traditional-instruments"** where spec-detail-ten.md writes "Traditional
  // Instruments". The rows agree with the design mock (formerly
  // `lib/post-ad.ts:6108`, deleted in the 2026-10-30 mock-data cleanup),
  // so the rows stand and the spec wording loses — the same mock-wins rule as
  // apartment-for-rent's dropped `facing` and the Fashion & Beauty / Furniture
  // type lists. Its Condition row was already in
  // `ListingSpecs.CONDITION_SUBCATEGORIES`, so the published grid needed no
  // change either.
  "musical-instruments",
  "fishing",
  "hike-and-camping",
  "cds-dvds-vhs",
  "books",
  "sports-equipment",
  "hobbies-others",
  // Pets — all 7 subcategories, opted in 2026-09-28. **No new block and no new
  // code**: the family's 11 keys ARE `commonListingFields`, and all 7 seeded
  // `fieldSchema` arrays match that const field-for-field (key, type, required,
  // max, label, options — proven by parsing the seed, not by eye).
  // spec-detail-eleven.md is 15 lines and says "they have the same form",
  // pointing at spec-detail-one.md:194-202 for the seven. `deliveryFree` and
  // `contactEmail` were the two keys that could have vanished silently; both
  // blocks exist (ListingPostForm.tsx:1093, :1212).
  "dogs",
  "cats",
  "birds",
  "fish",
  "pet-food",
  "pet-accessories",
  "other-pets",
  // Foods — all 10 subcategories, opted in 2026-09-28, the same shape as Pets
  // and the catalogue's last un-opted family. spec-detail-twelve.md is again 15
  // lines ("they have the same form") and points at spec-detail-one.md:203-214
  // for the ten; its header says "Meats" where spec-detail-one says "Meat",
  // which is cosmetic — the slug, the seed and the form all agree. With this
  // list every seeded subcategory in the catalogue runs the real form. The mock
  // `DynamicForm` below is NOT dead code: a subcategory created through the
  // admin UI later (no `field_schema`, so no entry here) still lands on it.
  "meat",
  "seafood",
  "fruits",
  "vegetables",
  "beverages",
  "grocery",
  "bread-and-bakery",
  "beer-and-wine",
  "rice-and-cereal",
  "other-foods",
];
