/**
 * A router param the auth screens carry so they can resume the flow the guest
 * was trying to reach. Today the only value is "sell": the promo card's
 * "Start Selling" (and anything else that needs an account to post) sends a
 * guest to Welcome first and back to the category chooser after sign-in.
 */
export const NEXT_SELL = "sell";

/** Where the auth screens land when `next=sell` is set. */
export const SELL_ROUTE = "/account/choose-category";

/** True when the auth flow should continue into the sell/post flow. */
export function wantsSellAfterAuth(next: string | undefined): boolean {
  return next === NEXT_SELL;
}
