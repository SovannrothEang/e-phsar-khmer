import type { ComponentProps } from "react";
import { Link } from "@/i18n/routing";
import { getFollowList, toFollowRow } from "@/lib/api/users";
import FollowListCard from "./FollowListCard";

/**
 * How many rows one page pulls. There is no "load more" yet, so this is the
 * ceiling on what a list shows — `hasMore` makes the card say so out loud
 * rather than silently truncating.
 */
const PAGE_SIZE = 50;

interface FollowListSectionProps {
  side: "following" | "followers";
  /** Whose lists these are — the profile owner, or the viewer's own id. */
  userId: string;
  hrefs: Record<"following" | "followers", ComponentProps<typeof Link>["href"]>;
  /** Signed-in viewer, for each row's toggle state. */
  viewerId: string | null;
}

/** Fetches one page of a follower/following list and renders the shared card. */
export default async function FollowListSection({
  side,
  userId,
  hrefs,
  viewerId,
}: FollowListSectionProps) {
  const { data, hasMore } = await getFollowList(userId, side, 1, PAGE_SIZE);

  return (
    <FollowListCard
      side={side}
      hrefs={hrefs}
      items={data.map(toFollowRow)}
      viewerId={viewerId}
      hasMore={hasMore}
    />
  );
}
