"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  IconLayoutGridFilled,
  IconListFilled,
} from "@tabler/icons-react"
import AllAdsCategories from "./AllAdsCategories"
import { GridCardPost }  from "@/components/ads/GridCardPost"
import { GridCardSell }  from "@/components/ads/GridCardSell"
import { ListCardPost }  from "@/components/ads/ListCardPost"
import { ListCardSell }  from "@/components/ads/ListCardSell"

// ─── Filter components ────────────────────────────────────────────────────────
import {
  LocationSelectorFilter,
  filterPostsByLocation,
  LOCATION_PRO_PARAM,
  LOCATION_DIS_PARAM,
} from "@/components/filter/LocationSelectorFilter"
import SortFilter, {
  SORT_PARAM,
  parseSortParam,
  sortPosts,
} from "@/components/filter/SortFilter"
import PriceFilter, {
  filterPostsByPrice,
  MAX_AD_PRICE_PARAM,
  MIN_AD_PRICE_PARAM,
  parsePriceParam,
} from "@/components/filter/PriceFilter"
import MoreFilters, {
  KEYWORD_PARAM,
  DATE_PARAM,
  filterPostsByKeyword,
  filterPostsByDate,
  type DateValue,
} from "@/components/filter/MoreFilters"

import { posts } from "@/lib/posts"

export default function AllAdsHeader() {
  const searchParams = useSearchParams()

  // ── Read all active params ─────────────────────────────────────────────────
  const minPrice = parsePriceParam(searchParams.get(MIN_AD_PRICE_PARAM))
  const maxPrice = parsePriceParam(searchParams.get(MAX_AD_PRICE_PARAM))
  const sort     = parseSortParam(searchParams.get(SORT_PARAM))
  const proId    = searchParams.get(LOCATION_PRO_PARAM) ?? undefined
  const disId    = searchParams.get(LOCATION_DIS_PARAM) ?? undefined
  const keyword  = searchParams.get(KEYWORD_PARAM)  ?? ""
  const date     = (searchParams.get(DATE_PARAM)    ?? "") as DateValue

  // ── Filter + sort pipeline ─────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    const byKeyword  = filterPostsByKeyword(posts, keyword)
    const byDate     = filterPostsByDate(byKeyword, date)
    const byLocation = filterPostsByLocation(byDate, proId, disId)
    const byPrice    = filterPostsByPrice(byLocation, minPrice, maxPrice)
    return sortPosts(byPrice, sort)
  }, [keyword, date, proId, disId, minPrice, maxPrice, sort])

  return (
    <Tabs defaultValue="grid" className="max-w-7xl select-none bg-muted">

      {/* Header title */}
      <div className="px-6 py-3 bg-card rounded-t-sm border">
        <h1 className="text-lg font-semibold text-card-foreground">
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

      {/* Grid view */}
      <TabsContent value="grid" className="mt-4">
        {filteredPosts.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            No ads match the selected filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <GridCardSell />
            {filteredPosts.map((post) => (
              <GridCardPost key={post.postId} post={post} />
            ))}
          </div>
        )}
      </TabsContent>

      {/* List view */}
      <TabsContent value="list" className="mt-4 space-y-4">
        {filteredPosts.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            No ads match the selected filters.
          </p>
        ) : (
          <>
            <ListCardSell />
            {filteredPosts.map((post) => (
              <ListCardPost key={post.postId} post={post} />
            ))}
          </>
        )}
      </TabsContent>

    </Tabs>
  )
}