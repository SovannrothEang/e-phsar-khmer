import PublicProfileHeader from "@/components/profile/PublicProfileHeader";
import AboutProfile from "@/components/profile/About";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { decodeRouteParam, definedQuery } from "@/lib/route-params";
import { permanentRedirect } from "@/i18n/routing";
import {
  getFollowStatus,
  getPublicProfile,
  toProfileUser,
} from "@/lib/api/users";

export default async function AboutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const username = decodeRouteParam(slug);
  const locale = await getLocale();

  // About is public-profile only — a listing slug resolves to no account.
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  // An old or differently-cased handle resolves to the current account;
  // send the browser to the canonical /about URL.
  if (profile.username && profile.username !== username) {
    const query = definedQuery(sp);
    return permanentRedirect({
      href: {
        pathname: "/[username]/about",
        params: { username: profile.username },
        // next-intl renders an empty query as a trailing `?`.
        query: Object.keys(query).length > 0 ? query : undefined,
      },
      locale,
    });
  }

  const user = toProfileUser(profile, locale);
  const viewer = await getCurrentUser();
  const following = await getFollowStatus(profile.id);

  return (
    <>
      <PublicProfileHeader
        user={user}
        viewerId={viewer?.id ?? null}
        initialFollowing={following}
      />
      <AboutProfile user={user} />
    </>
  );
}
