import Image from "next/image";
import { Link } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { IconHome, IconChevronRightFilled } from "@tabler/icons-react";
// ─── Header: one component; chip flags come from the maps below ──────────────
import LSPCYEHeader, {
  type LSPCYEHeaderProps,
} from "@/components/subcategory-layouts/LSPYCEHeader";
// ─── Content & posts ─────────────────────────────────────────────────────────
import SubcategoryContent from "@/components/subcategory-layouts/SubcategoryContent";
import type { OptionRow } from "@/components/subcategory-layouts/SubcategoryContent";
import { GridCardPost } from "@/components/ads/GridCardPost";
import { GridCardSell } from "@/components/ads/GridCardSell";
import { ListCardPost } from "@/components/ads/ListCardPost";
import { ListCardSell } from "@/components/ads/ListCardSell";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  getBrandsForSubcategory,
  getCategoryWithSubcategories,
  getLinkedAttributeOptions,
  getListingsFeed,
  getModelsForBrand,
  toCardPost,
} from "@/lib/api/categories";
import type { Post } from "@/lib/posts";

// ─── Bar chip flags: the design groups chips per main category; the vehicles
//     family has per-subcategory chip sets. All chips default to true (cars).
type HeaderFlags = Pick<
  LSPCYEHeaderProps,
  "year" | "engine" | "condition" | "price" | "priceLabel"
>;
const CATEGORY_HEADER_FLAGS: Record<string, HeaderFlags> = {
  "phones-and-tablets": { year: false, engine: false },
  "computers-and-accessories": { year: false, engine: false },
  "electronics-and-appliances": { year: false, engine: false },
  "home-and-land": {
    year: false,
    engine: false,
    condition: false,
    price: false,
  },
  services: { year: false, engine: false, condition: false, price: false },
  jobs: {
    year: false,
    engine: false,
    condition: false,
    priceLabel: "Salary",
  },
  "fashion-and-beauty": { year: false, engine: false, condition: false },
  "furniture-and-decor": { year: false, engine: false, condition: false },
  "books-sports-and-hobbies": {
    year: false,
    engine: false,
    condition: false,
  },
  pets: { year: false, engine: false, condition: false },
  foods: { year: false, engine: false, condition: false },
};
const SUBCATEGORY_HEADER_FLAGS: Record<string, HeaderFlags> = {
  "cars-for-sale": {},
  "motorcycles-for-sale": { engine: false },
  bicycles: { year: false, engine: false },
  "vehicles-for-rent": { year: false, engine: false, condition: false },
  "maintenance-and-repair": { year: false, engine: false, condition: false },
  "lorries-vans-and-tractors": {
    year: false,
    engine: false,
    condition: false,
  },
  "financing-and-insurance": { year: false, engine: false, condition: false },
  "tuk-tuk-and-remork": { year: false, engine: false, condition: false },
  "parts-and-accessories": { year: false, engine: false, condition: false },
  "vehicles-others": { year: false, engine: false, condition: false },
};
const DEFAULT_HEADER_FLAGS: HeaderFlags = {
  year: false,
  engine: false,
  condition: false,
};
// ─── Attribute sets rendered as option grids on the browse pages; the rows
//     carry subcategoryIds (UUIDs) — the page filters by the subcategory id. ──
const ATTRIBUTE_SET_TITLES: Record<string, string> = {
  bodytypes: "Body Type",
  types: "Type",
  accessories: "Accessories",
  networks: "Network",
  jobtypes: "Job Type",
  enginetypes: "Engine Type",
  vehicletypes: "Vehicle Type",
  colors: "Color",
  bedrooms: "Bedroom",
  bathrooms: "Bathroom",
  facings: "Facing",
  experiences: "Experience",
  rams: "RAM",
  cpus: "CPU",
  storage_phone: "Storage",
  storage_computer: "Storage",
  screensize_laptop: "Screen Size",
  screensize_monitor: "Screen Size",
  vgas: "VGA",
};
const ATTRIBUTE_SET_TYPES = Object.keys(ATTRIBUTE_SET_TITLES);
// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SubcategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string; subcategorySlug: string }>;
  searchParams: Promise<{
    ad_field?: string;
    ad_type?: string;
    ad_model?: string;
  }>;
}) {
  const { categorySlug, subcategorySlug } = await params;
  const sp = await searchParams;
  const locale = await getLocale();

  // Single category fetch covers both sides: breadcrumb names + subcategory
  // identity (id/slug/name/icon). The backend localizes names via
  // Accept-Language; failures degrade to a 404-free "Page not found".
  const category = await getCategoryWithSubcategories(categorySlug, locale);
  const subcategory = category?.subcategories.find(
    (s) => s.slug === subcategorySlug,
  );
  if (!category || !subcategory) {
    return <div>Page not found</div>;
  }

  // Live option grids for every subcategory with linked data: brands + models
  // (cars, phones/tablets/smart-watches, ...) plus every linked attribute set
  // (body types / types / bedrooms / ...) — the subcategoryIds filter (UUIDs)
  // naturally returns [] for subcategories without links.
  let brands: OptionRow[] | null = null;
  let models: OptionRow[] | null = null;

  const brandRows = await getBrandsForSubcategory(subcategory.slug);
  if (brandRows.length > 0) {
    brands = brandRows.map((b) => ({
      slug: b.slug,
      name: b.name,
      // OptionGrid reads `image`; backend rows carry `icon`
      image: b.icon,
    }));
  }

  // One call returns every attribute row linked to this subcategory (the
  // denormalized subcategoryIds mirror of the admin UI); rows are grouped
  // into per-set grids below.
  const linkedRows = await getLinkedAttributeOptions(subcategory.id);
  const sets = ATTRIBUTE_SET_TYPES.map((type) => ({
    slug: type,
    title: ATTRIBUTE_SET_TITLES[type],
    options: linkedRows
      .filter((r) => r.type === type)
      .map((r) => ({ slug: r.slug, name: r.name, image: r.image })),
  })).filter((s) => s.options.length > 0);

  // Model grid for the selected brand (per-brand fetch; brands carry no nested models)
  if (sp.ad_field) {
    const selected = brandRows.find((b) => b.slug === sp.ad_field);
    if (selected) {
      const modelRows = await getModelsForBrand(selected.id);
      if (modelRows.length > 0) {
        models = modelRows.map((m) => ({ slug: m.slug, name: m.name }));
      }
    }
  }

  const brand = sp.ad_field;
  const bodyType = sp.ad_type;
  const isFiltered = !!(brand || bodyType);

  // OptionGrid links carry slugs; the feed filters on the display names the
  // post form stores in `attributes` — map slug → name before fetching.
  const brandName = brand
    ? brandRows.find((b) => b.slug === brand)?.name
    : undefined;
  const bodyTypeName = bodyType
    ? sets.flatMap((s) => s.options).find((o) => o.slug === bodyType)?.name
    : undefined;

  // Real active listings — every subcategory now runs the real feed; the
  // grid/list toggle drives the two TabsContent views below.
  const feedItems: Post[] = (
    (
      await getListingsFeed(
        { subcategorySlug, brand: brandName, bodyType: bodyTypeName },
        locale,
      )
    )?.items ?? []
  ).map(toCardPost);

  // ── Header component ────────────────────────────────────────────────────────
  const headerFlags =
    SUBCATEGORY_HEADER_FLAGS[subcategory.slug] ??
    CATEGORY_HEADER_FLAGS[category.slug] ??
    DEFAULT_HEADER_FLAGS;

  // ── Active filter label — display names when available (slug-derived
  //    fallback only: slugs like `honda-moto` would read "honda moto") ───────
  const filterLabel =
    brandName ?? bodyTypeName ?? (brand ?? bodyType)?.replace(/-/g, " ");

  return (
    <main className="min-h-screen flex flex-col bg-gray-100">
      {/* ── Top banner ad ─────────────────────────────────────────────────── */}
      <div className="w-full flex justify-center py-6">
        <div className="w-full max-w-4xl">
          <Link href="/">
            <AspectRatio
              ratio={4}
              className="bg-muted rounded-none cursor-pointer"
            >
              <Image
                src="/ads/landforsale.jpg"
                alt="Land for sale advertisement"
                fill
                priority
                className="object-cover rounded-none"
              />
            </AspectRatio>
          </Link>
        </div>
      </div>
      {/* ── Breadcrumb + header ───────────────────────────────────────────── */}
      <div className="px-4 py-2">
        <div className="max-w-7xl mx-auto w-full pb-1">
          <nav
            className="flex items-center gap-2 text-base"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="group flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-300 transition-colors duration-150"
            >
              <IconHome size={18} />
              <span>Home</span>
            </Link>
            <IconChevronRightFilled size={16} className="mt-1 text-gray-500" />
            <Link
              href={{
                pathname: "/category/[categorySlug]",
                params: { categorySlug: category.slug },
              }}
              className="text-gray-500 dark:text-gray-400 hover:text-blue-300 transition-colors duration-150"
            >
              {category.name}
            </Link>
            <IconChevronRightFilled size={16} className="mt-1 text-gray-500" />
            {isFiltered ? (
              <Link
                href={{
                  pathname: "/category/[categorySlug]/[subcategorySlug]",
                  params: {
                    categorySlug: category.slug,
                    subcategorySlug: subcategory.slug,
                  },
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-blue-300 transition-colors duration-150"
              >
                {subcategory.name}
              </Link>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">
                {subcategory.name} in Cambodia
              </span>
            )}
            {isFiltered && (
              <>
                <IconChevronRightFilled
                  size={16}
                  className="mt-1 text-gray-500"
                />
                <span className="text-gray-500 dark:text-gray-400 capitalize">
                  {filterLabel} in Cambodia
                </span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* The grid/list toggle in the cars-for-sale header drives the two
          TabsContent views below; the header is NOT wrapped in a short div —
          the bar inside it is sticky and needs the tall Tabs root as its
          containing block (same pattern as the category page). */}
      <Tabs defaultValue="grid" className="max-w-7xl mx-auto w-full pb-2">
        {/* Subcategory header */}
        <LSPCYEHeader title={subcategory.name} {...headerFlags} />
        {/* Main listing content (visible in both grid/list views — same as
            SubcategoryGrid on the category page) */}
        <div>
          <SubcategoryContent
            categorySlug={category.slug}
            subcategorySlug={subcategory.slug}
            brands={brands}
            models={models}
            sets={sets}
          />
        </div>
        {/* ── Post sections: grid/list views driven by the bar's toggle ── */}
        <TabsContent value="grid" className="mt-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <GridCardSell />
            {feedItems.map((post) => (
              <GridCardPost key={post.postId} post={post} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="list" className="mt-2">
          <>
            <ListCardSell />
            {feedItems.map((post) => (
              <ListCardPost key={post.postId} post={post} />
            ))}
          </>
        </TabsContent>
      </Tabs>
    </main>
  );
}
