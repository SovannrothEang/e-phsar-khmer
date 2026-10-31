/**
 * The wire vocabulary of `POST /insights/events` and `GET /insights/me`.
 * Kept in sync with `LISTING_EVENT_TYPES` in the backend schema by hand — the
 * repo has no shared types package between the two apps.
 */
export const LISTING_EVENT_TYPES = [
  "impression",
  "view",
  "chat",
  "call",
  "show_contact",
  "apply_job",
] as const;

export type ListingEventType = (typeof LISTING_EVENT_TYPES)[number];

export interface InsightEventInput {
  listingId: string;
  type: ListingEventType;
}

/** The flat summary `/insight` renders; engagement is server-computed. */
export interface InsightSummary {
  impression: number;
  engagement: number;
  view: number;
  chat: number;
  call: number;
  showContact: number;
  applyJob: number;
}
