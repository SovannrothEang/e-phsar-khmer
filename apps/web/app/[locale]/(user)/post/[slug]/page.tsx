import PostDetail from "@/components/post/Post-Detail"
import { posts } from "@/lib/posts";
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
    const { slug } = await params;
    // Extract actual ID if the URL has the slug format (e.g., "post-title-adid-123")
    const actualId = slug?.includes("-adid-") ? slug.split("-adid-").pop() : slug;
    const post = posts.find((p) => p.postId.toString() === actualId);

    if (post) {
        // Format: "Post Title - adid-ID"
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

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // Extract actual ID if the URL has the slug format (e.g., "post-title-adid-123")
    const actualId = id?.includes("-adid-") ? id.split("-adid-").pop() || id : id;

    return (
      <PostDetail id={actualId} />
    )
}
