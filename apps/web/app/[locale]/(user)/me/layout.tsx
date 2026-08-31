import {
  MyProfileHeader,
  type ProfileUser,
} from "@/components/profile/MyProfileHeader";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser, type SessionUser } from "@/lib/auth/current-user";

function toProfileUser(me: SessionUser): ProfileUser {
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
    // No following/follower data on the backend yet — Phase C.
    following: 1,
    follower: 2,
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

  return (
    <>
      <MyProfileHeader user={toProfileUser(me)} isOwnProfile />
      {children}
    </>
  );
}
