import { Link } from "@/i18n/routing";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { IconHome, IconChevronRightFilled } from "@tabler/icons-react";
import { getLocale } from "next-intl/server";
import AllAdsCategories from "@/components/all-ads/AllAdsCategories";
import AllAdsFeed from "@/components/all-ads/AllAdsFeed";
import { getListingsFeed, toCardPost } from "@/lib/api/categories";
import { ALL_ADS_PAGE_SIZE, parseAllAdsFilters } from "@/lib/all-ads";

export default async function AllAdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const filters = parseAllAdsFilters((key) => {
    const value = sp[key];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  });

  // The whole active catalogue, first screen only — AllAdsFeed appends the
  // rest from the feed's own cursor as the visitor reaches the bottom. There
  // are no highlight/top-ad blocks here: nothing in the data model backs one,
  // and the mock `AdsPhoto`/`HighLightAds` strips map every mock post, so they
  // can never sit in a real branch.
  const feed = await getListingsFeed(
    { ...filters, limit: ALL_ADS_PAGE_SIZE },
    locale,
  );

  return (
    <main className="min-h-screen flex flex-col bg-muted">
      <div className="w-full flex justify-center py-6">
        <div className="w-full max-w-4xl">
          <Link href="/" target="_blank">
            <AspectRatio
              ratio={4}
              className="bg-background rounded-none cursor-pointer"
            >
              <Image
                src="/ads/flag-animation.gif"
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
        <div className="max-w-7xl mx-auto w-full pb-2">
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
              All Ads in Cambodia
            </h1>
          </nav>
        </div>
      </div>
      <div className="max-w-7xl mx-auto w-full pb-2">
        {/* Keyed on the filters: a filter change re-renders this page, and the
            key makes the accumulated screens reset with the new first one. */}
        <AllAdsFeed
          key={JSON.stringify(filters)}
          initialPosts={(feed?.items ?? []).map(toCardPost)}
          initialCursor={feed?.nextCursor ?? null}
          filters={filters}
          locale={locale}
        >
          <AllAdsCategories />
        </AllAdsFeed>
      </div>
    </main>
  );
}
