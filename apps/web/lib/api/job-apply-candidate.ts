/**
 * Whether the Apply control can apply to this listing for this viewer at all:
 * an active job the viewer neither owns nor is signed out of. Pure (no I/O) so
 * the page can decide synchronously whether to show a placeholder for the
 * résumé/application lookup instead of waiting on it.
 */
export function isJobApplyCandidate(input: {
  categorySlug: string | undefined;
  listingStatus: string;
  posterId: string;
  viewerId: string | null | undefined;
}): boolean {
  return (
    input.categorySlug === "jobs" &&
    input.listingStatus === "active" &&
    !!input.viewerId &&
    input.viewerId !== input.posterId
  );
}
