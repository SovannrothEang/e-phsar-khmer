import type { ListingContext } from "@/types/chat";

/**
 * Handoff between "Message seller" and the chat page for the listing preview
 * card. The backend only returns a `ListingContext` once a message carrying
 * that `listingId` has actually been sent (it's read off the `messages` row),
 * but the conversation itself is now created eagerly — see
 * `startConversationWith` — so the thread can be empty when the chat page
 * first renders. Rather than show the "listing unavailable" tombstone until
 * the first send, the button that already has the listing on screen stashes
 * a preview here; the chat page reads it back for the same tab.
 *
 * SessionStorage, not a URL param: keeps listing details (title, price) out
 * of the address bar/history, and matches the handoff pattern already used
 * for OTP registration (`lib/otp-registration.ts`).
 */
const KEY_PREFIX = "chat_listing_preview:";

export function storeListingPreview(listing: ListingContext): void {
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${listing.id}`, JSON.stringify(listing));
  } catch {
    // Private mode / quota — the chat page falls back to the tombstone card.
  }
}

export function readListingPreview(listingId: string): ListingContext | null {
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${listingId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ListingContext>;
    if (parsed.id !== listingId || typeof parsed.title !== "string")
      return null;
    return {
      id: parsed.id,
      title: parsed.title,
      price: typeof parsed.price === "string" ? parsed.price : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : "USD",
      status:
        parsed.status === "draft" ||
        parsed.status === "active" ||
        parsed.status === "expired" ||
        parsed.status === "deleted"
          ? parsed.status
          : "active",
      thumbnailUrl:
        typeof parsed.thumbnailUrl === "string" ? parsed.thumbnailUrl : null,
    };
  } catch {
    return null; // corrupt JSON / storage unavailable
  }
}
