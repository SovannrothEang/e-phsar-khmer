"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconLayoutGridFilled, IconListFilled } from "@tabler/icons-react";
import AllAdsCategories from "./AllAdsCategories";
import { GridCardSell } from "@/components/ads/GridCardSell";
import { ListCardSell } from "@/components/ads/ListCardSell";
import { LocationSelectorFilter } from "@/components/filter/LocationSelectorFilter";
import SortFilter from "@/components/filter/SortFilter";
import PriceFilter from "@/components/filter/PriceFilter";
import MoreFilters from "@/components/filter/MoreFilters";
import { FeedResults } from "@/components/search/FeedResults";
import type { ListingsFeedParams } from "@/lib/api/categories";
import type { Post } from "@/lib/posts";

interface AllAdsHeaderProps {
  /** First page of the real feed, fetched by the page with `query`. */
  posts: Post[];
  nextCursor: string | null;
  query: ListingsFeedParams;
  locale: string;
  /** Changes whenever the filters do, so the load-more state resets. */
  feedKey: string;
}

/**
 * All Ads = the whole real feed, narrowed by the same URL filters as every
 * other feed page (the page parses them with `parseFeedParams`).
 */
export default function AllAdsHeader({
  posts,
  nextCursor,
  query,
  locale,
  feedKey,
}: AllAdsHeaderProps) {
  return (
    <Tabs defaultValue="grid" className="max-w-7xl select-none bg-muted">
      {/* Header title */}
      <div className="px-6 py-3 bg-card rounded-t-sm border">
        <h1 className="type-page-title text-card-foreground">
          All Ads in Cambodia
        </h1>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-40 flex items-center justify-between bg-card rounded-b-sm border px-4 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <LocationSelectorFilter />
          <SortFilter />
          <PriceFilter />
          <MoreFilters />
        </div>
        <TabsList className="h-9 shrink-0">
          <TabsTrigger value="grid" className="cursor-pointer px-3">
            <IconLayoutGridFilled className="size-4" />
          </TabsTrigger>
          <TabsTrigger value="list" className="cursor-pointer px-3">
            <IconListFilled className="size-4" />
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Category filter */}
      <div>
        <AllAdsCategories />
      </div>

      {posts.length === 0 ? (
        <>
          {(["grid", "list"] as const).map((v) => (
            <TabsContent key={v} value={v} className="mt-4">
              <p className="py-12 text-center text-muted-foreground">
                No ads match the selected filters.
              </p>
            </TabsContent>
          ))}
        </>
      ) : (
        <FeedResults
          key={feedKey}
          initialPosts={posts}
          initialCursor={nextCursor}
          query={query}
          locale={locale}
          gridLead={<GridCardSell />}
          listLead={<ListCardSell />}
        />
      )}
    </Tabs>
  );
}
