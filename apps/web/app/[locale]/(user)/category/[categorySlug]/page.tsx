import { Link } from "@/i18n/routing";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { IconHome, IconChevronRightFilled } from "@tabler/icons-react";
import CommonCategoryLayout from "@/components/category-layouts/CommonCategoryLayout";
import ServicesCategoryLayout from "@/components/category-layouts/ServicesCategoryLayout";
import JobsCategoryLayout from "@/components/category-layouts/JobsCategoryLayout";
import CarsCategoryLayout from "@/components/category-layouts/CarsCategoryLayout";
import SubcategoryGrid from "@/components/category-layouts/SubcategoryGrid";
import OptionGrid from "@/components/subcategory-layouts/OptionGrid";
import { GridCardPost } from "@/components/ads/GridCardPost";
import { GridCardSell } from "@/components/ads/GridCardSell";
import { ListCardPost } from "@/components/ads/ListCardPost";
import { ListCardSell } from "@/components/ads/ListCardSell";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  getAttributeOptions,
  getCategoryWithSubcategories,
  getListingsFeed,
  toCardPost,
} from "@/lib/api/categories";

const SUBCATEGORY_LAYOUT: Record<string, number> = {
  "cars-and-vehicles": 5,
  "phones-and-tablets": 5,
  "computers-and-accessories": 7,
  "electronics-and-appliances": 6,
  "home-and-land": 6,
  jobs: 8,
  services: 8,
  "fashion-and-beauty": 6,
  "furniture-and-decor": 5,
  "books-sports-and-hobbies": 7,
  pets: 7,
  foods: 5,
};

// Categories with special layouts
const COMMON_CATEGORIES = [
  "phones-and-tablets",
  "computers-and-accessories",
  "electronics-and-appliances",
  "home-and-land",
  "fashion-and-beauty",
  "furniture-and-decor",
  "books-sports-and-hobbies",
  "pets",
  "foods",
];
const CARS_CATEGORIES = ["cars-and-vehicles"];
const SERVICES_CATEGORIES = ["services"];
const JOBS_CATEGORIES = ["jobs"];

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<{ ad_type?: string }>;
}) {
  const { categorySlug } = await params;
  const { ad_type: adType } = await searchParams;
  const locale = await getLocale();

  const category = await getCategoryWithSubcategories(categorySlug, locale);

  if (!category) {
    notFound();
  }

  let Layout;

  if (COMMON_CATEGORIES.includes(category.slug)) {
    Layout = CommonCategoryLayout;
  } else if (SERVICES_CATEGORIES.includes(category.slug)) {
    Layout = ServicesCategoryLayout;
  } else if (JOBS_CATEGORIES.includes(category.slug)) {
    Layout = JobsCategoryLayout;
  } else if (CARS_CATEGORIES.includes(category.slug)) {
    Layout = CarsCategoryLayout;
  } else {
    Layout = CommonCategoryLayout;
  }

  //  FIXED
  const cols = SUBCATEGORY_LAYOUT[category.slug] ?? 6;

  // Job Type on the category page (captain, 2026-09-27): the jobs page runs the
  // same `jobtypes` grid its subcategory pages do, so a visitor can narrow the
  // feed by type BEFORE choosing a job. The rows are the ones ticked for this
  // category's subcategories — `subcategoryIds` is the truth once a set is
  // managed, and `jobtypes` is (all 36 job subcategories) — and the grid steps
  // aside once a type is applied, exactly as the subcategory grids do. The
  // pick then carries into the chosen job: the tile links forward the current
  // query (`ad_type` included), where `SET_FIELD_KEYS.jobtypes` resolves it to
  // the same `jobType` predicate, so the feed stays filtered. Only jobs gets
  // this; another family would need its own decision about which set applies.
  const subIds = new Set(category.subcategories.map((s) => s.id));
  const jobTypeOptions =
    category.slug === "jobs"
      ? (await getAttributeOptions("jobtypes"))
          .filter((row) => row.subcategoryIds.some((id) => subIds.has(id)))
          .map((row) => ({ slug: row.slug, name: row.name, image: row.image }))
      : [];
  const appliedJobType = adType
    ? jobTypeOptions.find((o) => o.slug === adType)?.name
    : undefined;

  // Real active listings feed for every category. Cards render through the
  // existing GridCardPost / ListCardPost templates via the toCardPost adapter.
  const feedPosts = (
    (
      await getListingsFeed(
        {
          categorySlug,
          attrKey: appliedJobType ? "jobType" : undefined,
          attrValue: appliedJobType,
        },
        locale,
      )
    )?.items ?? []
  ).map(toCardPost);

  // Same content as the All Ads feed: Sell-banner card + the posts feed, rendered
  // as grid cards (grid view) or list cards (list view).
  const gridSections = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <GridCardSell />
      {feedPosts.map((post) => (
        <GridCardPost key={post.postId} post={post} />
      ))}
    </div>
  );

  const listSections = (
    <>
      <ListCardSell />
      {feedPosts.map((post) => (
        <ListCardPost key={post.postId} post={post} />
      ))}
    </>
  );

  return (
    <main className="min-h-screen flex flex-col bg-muted">
      <div className="w-full flex justify-center py-6">
        <div className="w-full max-w-4xl">
          <Link href="/" target="_blank">
            <AspectRatio
              ratio={4}
              className="bg-muted rounded-none cursor-pointer"
            >
              <Image
                src="/ads/landforsale.jpg"
                alt="Photo"
                fill
                priority
                className="object-cover rounded-none"
              />
            </AspectRatio>
          </Link>
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="max-w-7xl mx-auto w-full pb-1">
          <nav className="flex items-center gap-2 text-base">
            <Link
              href="/"
              className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300"
            >
              <IconHome
                size={18}
                className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300"
              />
              <span className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300 pl-1.5">
                Home
              </span>
            </Link>
            <IconChevronRightFilled
              size={16}
              className="block mt-1 text-gray-500"
            />
            <h1 className="text-gray-500 dark:text-gray-400">
              {category.name} <span>in Cambodia</span>
            </h1>
          </nav>
        </div>
      </div>

      {/* The grid/list toggle in the layout above drives these two views:
          grid → grid post cards, list → list post cards (All Ads behaviour).
          The layout is NOT wrapped in a short div — the bar inside it is
          sticky and needs the tall Tabs root as its containing block. */}
      <Tabs defaultValue="grid" className="max-w-7xl mx-auto w-full pb-2">
        <Layout category={category} />
        <div>
          <SubcategoryGrid
            categorySlug={category.slug}
            subcategories={category.subcategories}
            cols={cols}
          />
        </div>
        {/* Below the tiles' Show More, per the captain's note (2026-09-27). */}
        {jobTypeOptions.length > 0 && !appliedJobType && (
          <OptionGrid
            title="Job Type"
            options={jobTypeOptions}
            baseHref={`/category/${category.slug}`}
            paramKey="body_type"
            imageTiles
          />
        )}
        <TabsContent value="grid" className="mt-4">
          {gridSections}
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          {listSections}
        </TabsContent>
      </Tabs>
    </main>
  );
}
