import PostDetail from "@/components/post/Post-Detail";
import { getListingById } from "@/lib/api/categories";
import { getLocale } from "next-intl/server";
import { loadPostDetailProps } from "@/lib/api/post-detail-props";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Extract the actual ID if the URL has the slug format (e.g., "post-title-adid-123")
function extractId(slug: string): string {
  return slug?.includes("-adid-") ? slug.split("-adid-").pop() || slug : slug;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const actualId = extractId(slug);

  // Real listings are looked up by UUID; any other id is a dead link. Same
  // locale as the page body asks for, so the two share one request
  // (`getListingById` is memoised per request).
  if (UUID_RE.test(actualId)) {
    const listing = await getListingById(actualId, await getLocale());
    if (listing) {
      return {
        title: listing.title,
        description: listing.description ?? "Post Detail",
      };
    }
  }
  return { title: "404 Not found" };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const actualId = extractId(slug);
  // A malformed id is a dead link — nothing to ask the backend.
  if (!UUID_RE.test(actualId)) notFound();

  const props = await loadPostDetailProps(actualId, await getLocale());
  // A real listing that is gone (draft, withdrawn, moderated, unknown id)
  // must 404 rather than render a fabricated ad at a dead link. Decided here,
  // before any HTML is sent, so the response status is still a real 404.
  if (!props) notFound();
  return <PostDetail {...props} />;
}
