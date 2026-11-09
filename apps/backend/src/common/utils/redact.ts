/**
 * The nearby endpoint's origin is the caller's device fix. It must not be
 * written to any log, so redact these two query values while leaving the rest
 * of the URL (method, path, other filters) intact for debugging.
 */
const SENSITIVE_QUERY_RE = /([?&])(lat|lng|latitude|longitude)=[^&]*/gi;

export function redactSensitiveQuery(url: string): string {
  return url.replace(SENSITIVE_QUERY_RE, '$1$2=[redacted]');
}
