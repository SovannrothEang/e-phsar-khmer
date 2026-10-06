import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/current-user";
import FollowListSection from "@/components/profile/FollowListSection";

const HREFS = {
  following: "/me/following",
  followers: "/me/followers",
} as const;

export default async function MyFollowersPage() {
  const me = await getCurrentUser();
  const locale = await getLocale();
  if (!me) return redirect({ href: "/login", locale });

  return (
    <FollowListSection
      side="followers"
      userId={me.id}
      hrefs={HREFS}
      viewerId={me.id}
    />
  );
}
