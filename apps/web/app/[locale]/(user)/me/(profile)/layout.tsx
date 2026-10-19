import {
  MyProfileHeader,
  type ProfileUser,
} from "@/components/profile/MyProfileHeader";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser, type SessionUser } from "@/lib/auth/current-user";
import { getMyFollowCounts } from "@/lib/api/users";

function toProfileUser(
  me: SessionUser,
  counts: { followers: number; following: number } | null,
): ProfileUser {
  const name =
    [me.firstName, me.lastName].filter(Boolean).join(" ").trim() ||
    me.username ||
    "My Account";
  const avatar =
    me.profilePhotoUrl ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a0e9&color=fff`;
  const joinDate = new Date(me.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return {
    name,
    username: me.username ?? "",
    avatar,
    cover: me.coverPhotoUrl ?? "",
    // Real counts. A failed fetch degrades to 0 rather than to a made-up
    // number — a wrong count is worse than a missing one.
    following: counts?.following ?? 0,
    follower: counts?.followers ?? 0,
    joinDate,
  };
}

export default async function MyProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  const locale = await getLocale();
  if (!me) return redirect({ href: "/login", locale });

  const counts = await getMyFollowCounts();

  return (
    <>
      <MyProfileHeader user={toProfileUser(me, counts)} isOwnProfile />
      {children}
    </>
  );
}
