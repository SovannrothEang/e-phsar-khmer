/**
 * Reading a JWT's expiry **without verifying it**.
 *
 * Only used to decide whether a cookie is worth a request at all: the API
 * still verifies the signature on every call. A token with no parseable `exp`
 * is treated as unusable, because the alternative is a guaranteed 401.
 */
export function isJwtExpired(
  token: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return true;

  const payload = token.split(".")[1];
  if (!payload) return true;

  try {
    // base64url → JSON. `atob` is available in the Edge runtime and in Node.
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { exp?: unknown };
    if (typeof claims.exp !== "number") return true;
    return claims.exp * 1000 <= nowMs;
  } catch {
    return true;
  }
}
