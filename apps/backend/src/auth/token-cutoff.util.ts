/**
 * True when a JWT must be refused because it was issued before the user's
 * `tokensValidAfter` cutoff (set on password reset).
 *
 * `iat` is whole seconds, so the cutoff is compared at second precision
 * (floored): a token minted in the same second as the reset is accepted. That
 * is deliberate, because the user signs in right after resetting and a stricter
 * comparison would reject that fresh login; the cost is that a token minted in
 * the same second BEFORE the reset survives. A token with no `iat` cannot be
 * proven newer, so it is refused once a cutoff exists.
 */
export function isIssuedBeforeCutoff(
  iat: number | undefined,
  tokensValidAfter: Date | null | undefined,
): boolean {
  if (!tokensValidAfter) return false;
  if (typeof iat !== 'number') return true;
  return iat < Math.floor(tokensValidAfter.getTime() / 1000);
}
