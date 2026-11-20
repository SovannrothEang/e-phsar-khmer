import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { permanentRedirect } from "@/i18n/routing";
import { decodeRouteParam, definedQuery } from "@/lib/route-params";
import { getPublicProfile } from "@/lib/api/users";

/**
 * The list is part of the profile now — `?tab=following` swaps it in under the
 * header without a navigation. This route stays only so links already shared
 * keep working, and sends them on to the canonical URL.
 */
export default async function ProfileFollowingRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicProfile(decodeRouteParam(slug));
  if (!profile) notFound();

  // `profile.username` is the current handle even when the requested slug is
  // an old one, so this also canonicalizes renamed accounts.
  return permanentRedirect({
    href: {
      pathname: "/[username]",
      params: { username: profile.username ?? slug },
      query: { ...definedQuery(sp), tab: "following" },
    },
    locale: await getLocale(),
  });
}
