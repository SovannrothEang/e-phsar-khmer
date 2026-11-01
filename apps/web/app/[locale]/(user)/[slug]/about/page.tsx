import PublicProfileHeader from "@/components/profile/PublicProfileHeader";
import AboutProfile from "@/components/profile/About";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getFollowStatus,
  getPublicProfile,
  toProfileUser,
} from "@/lib/api/users";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // About is public-profile only — a listing slug resolves to no account.
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  const user = toProfileUser(profile, await getLocale());
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
