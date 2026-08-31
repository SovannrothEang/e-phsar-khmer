import { posts, type Post } from "@/lib/posts";
import { ListCardPost } from "./ListCardPost";
import { ListCardSell } from "./ListCardSell";

export default function NormalAds({ posts: feedPosts }: { posts?: Post[] }) {
  const items = feedPosts ?? posts;
  return (
    <section className="mt-10">
      <div className="max-w-6xl mx-auto w-full">
        <ListCardSell />
        {items.map((post) => (
          <ListCardPost key={post.postId} post={post} />
        ))}
      </div>
    </section>
  );
}
