/**
 * How many of the newest notifications the navbar bell panel shows: the wide
 * screen's popover fits 6 without scrolling much; the compact screen's drawer
 * is a tall scroll surface, so it takes 8.
 */
export function notificationPreviewLimit(isCompact: boolean): number {
  return isCompact ? 8 : 6;
}
