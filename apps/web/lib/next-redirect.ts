/**
 * Does this rejected Server Action call mean "the action redirected"?
 *
 * `redirect()` inside a Server Action is not a return value: the framework
 * answers with a redirect, navigates, and rejects the caller's promise with a
 * signal carrying a `NEXT_REDIRECT;…` digest. A client that awaits such an
 * action lands in its `catch` on every SUCCESSFUL call, so it must tell this
 * signal apart from a real failure — otherwise it shows an error on the happy
 * path. Actions like `login()` / `verifyOtp()` end in a redirect, so every
 * caller needs this check.
 *
 * The digest is framework-internal but stable across the App Router, and it is
 * the only signal available client-side (Next does not export a guard).
 */
export function isServerRedirect(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
