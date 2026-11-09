import { toSlug } from "./utils.ts";

/**
 * Canonical public site identity. Share links, QR codes, metadata and contact
 * copy read from here so a domain change is one edit.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://phsarkhmer.com";

export const CONTACT_EMAIL = "info@phsarkhmer.com";

/**
 * Known admin host prefixes. The dashboard and the marketplace are separate
 * surfaces (`proxy.ts` 404s every non-`/wanderer` path on an admin host), so a
 * marketplace link opened from the dashboard must never inherit the admin
 * origin — that is what turned "View post" into a 404 at
 * `admin.localhost:3001/en/<slug>-adid-<id>`.
 */
const ADMIN_HOST_PREFIXES = [
  "phsar-backoffice.",
  "phsar-admin.",
  "backoffice.",
  "admin.",
] as const;

/**
 * The marketplace origin to use for a public link opened from the dashboard.
 *
 * `NEXT_PUBLIC_SITE_URL` wins when set (a deployment that splits the hosts
 * configures it). Otherwise the admin prefix is stripped from the origin the
 * dashboard is currently served from, which is what makes local dev work
 * (`admin.localhost:3001` → `localhost:3001`) without pointing at production.
 */
export function publicSiteOrigin(
  currentOrigin: string,
  configured: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  if (configured) return configured.replace(/\/$/, "");
  try {
    const url = new URL(currentOrigin);
    const prefix = ADMIN_HOST_PREFIXES.find((p) => url.host.startsWith(p));
    if (prefix) url.host = url.host.slice(prefix.length);
    return url.origin;
  } catch {
    return SITE_URL;
  }
}

/**
 * The public detail URL for a listing, absolute.
 *
 * The route reads the id after `-adid-`; the slug is cosmetic, so a missing
 * title still resolves. Shared by the dashboard's two "view post" actions so
 * they cannot drift apart again.
 */
export function listingPublicUrl(input: {
  origin: string;
  locale: string;
  title: string | null;
  id: string;
}): string {
  const slug = toSlug(input.title ?? "listing") || "listing";
  return `${input.origin}/${input.locale}/${slug}-adid-${input.id}`;
}
