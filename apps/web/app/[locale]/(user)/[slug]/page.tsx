import PostDetail from "@/components/post/Post-Detail";
import PublicProfileHeader from "@/components/profile/PublicProfileHeader";
import HomeProfile from "@/components/profile/Home";
import { posts } from "@/lib/posts";
import { users } from "@/lib/user";
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;

  if (slug?.includes("-adid-")) {
    const actualId = slug.split("-adid-").pop();
    const post = posts.find((p) => p.postId.toString() === actualId);

    if (post) {
      return {
        title: `${post.title} - adid-${post.postId}`,
        description: post.description || "Post Detail",
      };
    }
    return {
      title: "Post Not Found - Psakhmer",
      description: "Post Detail",
    };
  }

  // Otherwise, treat as username
  const user = users.find((u) => u.username === slug);
  if (user) {
    return {
      title: `${user.name} - PsaKhmer`,
      description: `View profile of ${user.name}`,
    };
  }
  return {
    title: "User Not Found",
  };
}

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Handle Post Detail
  if (slug?.includes("-adid-")) {
    const actualId = slug.split("-adid-").pop() || slug;
    return <PostDetail id={actualId} />;
  }

  // Handle Public Profile
  const user = users.find((u) => u.username === slug);

  if (!user) return <div>Not found</div>;

  return (
    <>
      <PublicProfileHeader user={user} />
      <HomeProfile user={user} />
    </>
  );
}
