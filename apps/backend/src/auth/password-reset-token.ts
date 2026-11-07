/**
 * JWT `typ` claim marking a short-lived password-reset proof.
 *
 * The proof is minted only after the SMS code verified, and it shares
 * JWT_SECRET with access tokens — so JwtStrategy must reject it as a bearer,
 * exactly like the chat WS ticket (`chat/ws-ticket.ts`).
 */
export const PASSWORD_RESET_TYP = 'password_reset';

/** Enough time to type a new password; the OTP itself is already spent. */
export const PASSWORD_RESET_TTL_SECONDS = 10 * 60;

/**
 * A proof is single-use: it stays valid only while no password change has been
 * stamped after it was issued. `tokensValidAfter` is written by every reset
 * (and by other password changes), so a replay after the first use finds a
 * cutoff newer than the proof's `iat` and is rejected.
 */
export function resetProofStillValid(
  issuedAt: Date,
  tokensValidAfter: Date | null,
): boolean {
  return (
    tokensValidAfter === null ||
    tokensValidAfter.getTime() <= issuedAt.getTime()
  );
}
