import "server-only";
import type { ComponentProps } from "react";
import type PostDetail from "@/components/post/Post-Detail";
import { buildRealDetailData } from "@/lib/api/categories";
import { getAdvertisements } from "@/lib/api/advertisements";
import { loadJobApplyState } from "@/lib/api/job-apply";
import { isJobApplyCandidate } from "@/lib/api/job-apply-candidate";
import { getCurrentUser } from "@/lib/auth/current-user";

type PostDetailProps = ComponentProps<typeof PostDetail>;

/**
 * Everything the listing detail page needs, for both entry points
 * (`[slug]` and `post/[slug]`) so they can never drift apart.
 *
 * What must be on screen with the first byte is fetched in ONE wave: the
 * viewer, the banners and the listing (+ category tree for the breadcrumb)
 * start together instead of one after another. What can arrive a moment later
 * — the résumé/application lookup for an Apply control — is started here but
 * returned as a promise, so the page streams without waiting for it.
 *
 * The viewer's follow state deliberately does NOT travel with this response:
 * a per-viewer value would make the listing HTML differ between visitors, so
 * the browser asks for it after mount (`FollowSlot`).
 *
 * Returns null when the listing does not exist (draft, withdrawn, moderated,
 * unknown id). The caller turns that into `notFound()` BEFORE rendering: once
 * a response has started streaming, its status code can no longer become 404.
 */
export async function loadPostDetailProps(
  listingId: string,
  locale: string,
): Promise<PostDetailProps | null> {
  const [viewer, banners, real] = await Promise.all([
    getCurrentUser(),
    getAdvertisements("listing_detail"),
    buildRealDetailData(listingId, locale),
  ]);
  if (!real) return null;

  const sellerId = real.listing.userId;
  const jobInput = {
    listingId: real.listing.id,
    categorySlug: real.cate?.slug,
    listingStatus: real.listing.status,
    posterId: sellerId,
    viewerId: viewer?.id,
  };

  return {
    real,
    banners,
    viewerId: viewer?.id,
    jobApply: isJobApplyCandidate(jobInput)
      ? loadJobApplyState(jobInput).catch(() => null)
      : null,
  };
}
