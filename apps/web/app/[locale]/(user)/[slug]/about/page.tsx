import PublicProfileHeader from "@/components/profile/PublicProfileHeader";
import AboutProfile from "@/components/profile/About";
import { users } from "@/lib/user";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Assuming about is only for public profiles, not posts
  const user = users.find((u) => u.username === slug);

  if (!user) return <div>User not found</div>;

  return (
    <>
      <PublicProfileHeader user={user} />
      <AboutProfile user={user} />
    </>
  );
}
