import PostDetail from "@/components/post/Post-Detail";
import PublicProfileHeader from "@/components/profile/PublicProfileHeader";
import HomeProfile from "@/components/profile/Home";
import { buildRealDetailData, getListingById } from "@/lib/api/categories";
import { getLocale } from "next-intl/server";
import { posts } from "@/lib/posts";
import { users } from "@/lib/user";
import type { Metadata } from "next";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractId(slug: string): string {
  return slug?.includes("-adid-") ? slug.split("-adid-").pop() || slug : slug;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (slug?.includes("-adid-")) {
    const actualId = extractId(slug);
    // Real listings are looked up by UUID; anything else falls back to the mock feed.
    if (UUID_RE.test(actualId)) {
      const listing = await getListingById(actualId, "en");
      if (listing) {
        return {
          title: listing.title,
          description: listing.description ?? "Post Detail",
        };
      }
    }
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

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Handle Post Detail — title-adid-XXX slugs resolve to mock posts; real
  // listing UUIDs render through the real detail template.
  if (slug?.includes("-adid-")) {
    const actualId = extractId(slug);
    if (UUID_RE.test(actualId)) {
      const real = await buildRealDetailData(actualId, await getLocale());
      if (real) return <PostDetail id={actualId} real={real} />;
    }
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
