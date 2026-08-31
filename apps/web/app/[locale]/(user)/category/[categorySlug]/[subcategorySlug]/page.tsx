import type { ComponentType } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { getLocale } from "next-intl/server";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { IconHome, IconChevronRightFilled } from "@tabler/icons-react";
import {
  LSP_SUBCATEGORIES,
  LSPC_SUBCATEGORIES,
  LSPYCE_SUBCATEGORIES,
  LSPYC_SUBCATEGORIES,
  LS_SUBCATEGORIES,
  LSS_SUBCATEGORIES,
} from "@/lib/subcategoryGroups";
// ─── Subcategory header components ────────────────────────────────────────────
import LSPHeader from "@/components/subcategory-layouts/LSPHeader";
import LSPCHeader from "@/components/subcategory-layouts/LSPCHeader";
import LSPYCHeader from "@/components/subcategory-layouts/LSPYCHeader";
import LSPCYEHeader from "@/components/subcategory-layouts/LSPYCEHeader";
import LSHeader from "@/components/subcategory-layouts/LSHeader";
import LSSHeader from "@/components/subcategory-layouts/LSSHeader";
// ─── Content & ads ────────────────────────────────────────────────────────────
import SubcategoryContent from "@/components/subcategory-layouts/SubcategoryContent";
import type { OptionRow } from "@/components/subcategory-layouts/SubcategoryContent";
import HighLightAds from "@/components/ads/HighLightAds";
import NormalAd from "@/components/ads/NormalAd";
import AdsPhoto from "@/components/ads/AdsPhoto";
import {
  getBodyTypes,
  getBrandsForSubcategory,
  getCategoryWithSubcategories,
  getListingsFeed,
  getModelsForBrand,
  toCardPost,
} from "@/lib/api/categories";
import type { Post } from "@/lib/posts";

// ─── Header lookup map (avoids long if-else chain) ───────────────────────────
type HeaderProps = { title: string };
const buildMap = (
  slugs: string[],
  Component: ComponentType<HeaderProps>,
): Record<string, ComponentType<HeaderProps>> =>
  Object.fromEntries(slugs.map((s) => [s, Component]));
const HEADER_MAP: Record<string, ComponentType<HeaderProps>> = {
  ...buildMap(LSP_SUBCATEGORIES, LSPHeader),
  ...buildMap(LS_SUBCATEGORIES, LSHeader),
  ...buildMap(LSS_SUBCATEGORIES, LSSHeader),
  ...buildMap(LSPC_SUBCATEGORIES, LSPCHeader),
  ...buildMap(LSPYCE_SUBCATEGORIES, LSPCYEHeader),
  ...buildMap(LSPYC_SUBCATEGORIES, LSPYCHeader),
};
// ─── Ad block layout (deduped) ────────────────────────────────────────────────
const AD_BLOCKS: ComponentType[] = [
  NormalAd,
  AdsPhoto,
  HighLightAds,
  AdsPhoto,
  HighLightAds,
];
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
  // (cars, phones/tablets/smart-watches, ...). Body types are car-only — the
  // subcategoryIds filter (UUIDs) naturally returns [] for other subcategories.
  let brands: OptionRow[] | null = null;
  let bodyTypes: OptionRow[] | null = null;
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

  // bodytype rows carry denormalized subcategoryIds (UUIDs) — keep only the
  // rows relevant to this subcategory
  const btRows = await getBodyTypes();
  const filtered = btRows.filter((r) =>
    r.subcategoryIds?.includes(subcategory.id),
  );
  if (filtered.length > 0) {
    bodyTypes = filtered.map((r) => ({
      slug: r.slug,
      name: r.name,
      image: r.image,
    }));
  }

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
    ? bodyTypes?.find((b) => b.slug === bodyType)?.name
    : undefined;

  // Real active listings for cars-for-sale; any other subcategory keeps the
  // mock ad blocks untouched.
  const carFeed: Post[] | null =
    subcategory.slug === "cars-for-sale"
      ? (
          (
            await getListingsFeed(
              { subcategorySlug, brand: brandName, bodyType: bodyTypeName },
              locale,
            )
          )?.items ?? []
        ).map(toCardPost)
      : null;

  // ── Header component ────────────────────────────────────────────────────────
  const HeaderComponent: ComponentType<HeaderProps> =
    HEADER_MAP[subcategory.slug] ?? LSPHeader;

  // ── Active filter label (pre-existing mock bug, not fixed silently: the
  //    page reads `body_type` while OptionGrid writes `ad_type`) ──────────────
  const filterLabel = (brand ?? bodyType)?.replace(/-/g, " ");

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
          {/* Breadcrumb */}
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
          {/* Subcategory header */}
          <div className="mt-2">
            <HeaderComponent title={subcategory.name} />
          </div>
          {/* Main listing content */}
          <div className="py-2">
            <SubcategoryContent
              categorySlug={category.slug}
              subcategorySlug={subcategory.slug}
              brands={brands}
              bodyTypes={bodyTypes}
              models={models}
            />
          </div>
          {/* ── Ad blocks ───────────────────────────────────────────────────── */}
          {carFeed === null ? (
            AD_BLOCKS.map((AdComponent, index) => (
              <div key={index} className="max-w-7xl mx-auto w-full py-2">
                <AdComponent />
              </div>
            ))
          ) : carFeed.length > 0 ? (
            <>
              <div className="max-w-7xl mx-auto w-full py-2">
                <HighLightAds posts={carFeed} />
              </div>
              <div className="max-w-7xl mx-auto w-full py-2">
                <NormalAd posts={carFeed} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
