import "server-only";
import {
  getApplyResumeSummary,
  getMyApplicationForListing,
} from "@/actions/applications";
import type { JobApplyState } from "@/components/post/Post-Detail";
import { isJobApplyCandidate } from "./job-apply-candidate";

/**
 * The Apply control's state for one listing, or null when there is nothing to
 * offer: not a job, not active, the viewer's own listing, or no viewer.
 *
 * Both detail entry points (`post/[slug]` and the root `[slug]`) call this, so
 * the button can never appear on one route and not the other. The two reads
 * are fail-soft — a viewer with an unreachable backend still sees the button,
 * and the duplicate guard on the server is what actually prevents a double
 * application.
 */
export async function loadJobApplyState(input: {
  listingId: string;
  categorySlug: string | undefined;
  listingStatus: string;
  posterId: string;
  viewerId: string | null | undefined;
}): Promise<JobApplyState | null> {
  if (!isJobApplyCandidate(input)) return null;

  const [applied, resume] = await Promise.all([
    getMyApplicationForListing(input.listingId),
    getApplyResumeSummary(),
  ]);

  return { appliedApplicationId: applied?.id ?? null, resume };
}
