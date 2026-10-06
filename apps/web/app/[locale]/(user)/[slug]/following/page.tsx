import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getPublicProfile } from "@/lib/api/users";

/**
 * The list is part of the profile now — `?tab=following` swaps it in under the
 * header without a navigation. This route stays only so links already shared
 * keep working, and sends them on to the canonical URL.
 */
export default async function ProfileFollowingRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  return redirect({
    href: {
      pathname: "/[username]",
      params: { username: profile.username ?? slug },
      query: { tab: "following" },
    },
    locale: await getLocale(),
  });
}
