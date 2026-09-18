import { posts } from "@/lib/posts";
import { GridCardPost } from "./GridCardPost";

export default function AdsPhoto() {
  return (
    <section className="mt-10">
      {/* 4 PER ROW GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* NORMAL ADS */}
        {posts.map((post) => (
          <GridCardPost key={post.postId} post={post} />
        ))}
      </div>
    </section>
  );
}
