"use client"
import { useState } from "react"
import { ViewToggle } from "@/components/testcard/ViewToggle"
import { ListCardPost } from "@/components/ads/ListCardPost"
import { GridCardPost } from "@/components/ads/GridCardPost"
import { cn } from "@/lib/utils"

export default function AllAdsPage() {
  const [view, setView] = useState<"list" | "grid">("list")

  return (
    <div>
      {/* Filters bar */}
      <div className="flex items-center justify-between py-3">
        <div className="flex gap-2">
          {/* Location, Sort, Price, More Filters */}
        </div>
        <ViewToggle view={view} onViewChange={setView} />
      </div>

      {/* Posts */}
      <div className={cn(
        view === "grid"
          ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          : "flex flex-col divide-y divide-border"
      )}>
        {posts.map((post:any) =>
          view === "grid"
            ? <GridCardPost key={post.postId} post={post} />
            : <ListCardPost key={post.postId} post={post} />
        )}
      </div>
    </div>
  )
}