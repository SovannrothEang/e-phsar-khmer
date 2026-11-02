"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import HomeProfile from "./Home";
import FollowListPanel from "./FollowListPanel";
import { pushProfileTab, readProfileTab } from "@/lib/profile-tab";
import type { ProfileTab } from "@/lib/profile-tab";
import { feedQueryKey, type FeedQuery } from "@/lib/search-params";
import type { StripCategory, StripSelection } from "./SellerCategoryStrip";
import type { Post } from "@/lib/posts";

interface ProfileTabBodyProps {
  /** The profile being viewed. */
  userId: string;
  /** Signed-in viewer, or null — the follow lists need one. */
  viewerId: string | null;
  /** Everything the feed needs, passed straight through. */
  categories: StripCategory[];
  initialSelection: StripSelection;
  initialPosts: Post[];
  initialCursor: string | null;
  /** The profile bar's keyword/price/location/sort filters, parsed by the page. */
  filters: FeedQuery;
  locale: string;
}

/**
 * What sits under a profile's header: the seller's ads, or one of their follow
 * lists, chosen by `?tab=`.
 *
 * The URL is the state — there is no lifted state and no parent wrapper,
 * because both halves already read it: the header's counts push the param and
 * this reads it, so either can change the view without the other knowing.
 */
export default function ProfileTabBody({
  userId,
  viewerId,
  categories,
  initialSelection,
  initialPosts,
  initialCursor,
  filters,
  locale,
}: ProfileTabBodyProps) {
  const tab = readProfileTab(useSearchParams());

  const selectTab = React.useCallback((next: ProfileTab) => {
    pushProfileTab(next);
  }, []);

  if (tab) {
    return (
      <FollowListPanel
        // Switching lists remounts it, so it starts on its loading state
        // rather than having to reset itself mid-flight.
        key={tab}
        side={tab}
        userId={userId}
        viewerId={viewerId}
        onSelectTab={selectTab}
      />
    );
  }

  // Keyed on the filter set as well as the seller: a search or filter change
  // re-renders this page with a new first screen, and the key resets the
  // accumulated screens and the drill-down state with it (the drill itself is
  // re-seeded from `initialSelection`, which the URL still carries).
  return (
    <HomeProfile
      key={`${userId}|${feedQueryKey(filters)}`}
      userId={userId}
      categories={categories}
      initialSelection={initialSelection}
      initialPosts={initialPosts}
      initialCursor={initialCursor}
      filters={filters}
      locale={locale}
    />
  );
}
