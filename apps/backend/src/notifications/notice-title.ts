/** `notifications.title` is varchar(200); a seller's title can be longer. */
const NOTICE_TITLE_MAX = 120;

/**
 * Quotes and clips a listing title for a notification title or body. Shared by
 * every listing-notification producer (`listing.expiring`, `listing.removed`,
 * `listing.inactivated`) so they clip at the same length.
 */
export function quotedTitle(title: string): string {
  const trimmed = title.trim();
  const clipped =
    trimmed.length > NOTICE_TITLE_MAX
      ? `${trimmed.slice(0, NOTICE_TITLE_MAX - 1)}…`
      : trimmed;
  return `"${clipped}"`;
}
