import { posts } from "@/lib/posts";
import { ListCardPost } from "./ListCardPost";
import { ListCardSell } from "./ListCardSell";

export default function NormalAds() {
  return (
    <section className="mt-10">
      <div className="max-w-6xl mx-auto w-full">
        <ListCardSell />
        {posts.map((post) => (
          <ListCardPost key={post.postId} post={post} />
        ))}
      </div>
    </section>
  );
}
