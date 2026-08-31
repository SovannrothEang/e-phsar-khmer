import { TopPosts, type Post } from "@/lib/posts";
import { GridCardPost } from "./GridCardPost";
import { Sparkles } from "lucide-react";

export default function HighLightAds({ posts }: { posts?: Post[] }) {
  const items = posts ?? TopPosts;
  return (
    <div className=" rounded mt-4 bg-gradient-to-b from-[#0074ba] from-0% via-[#0074ba] via-[60px] to-white dark:from-primary-900 dark:to-black overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 mb-3">
        <h2 className="text-lg font-semibold text-zinc-800">Highlights</h2>

        <Sparkles size={20} className="text-yellow-400 fill-yellow-400" />
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pb-4 snap-x">
        {items.map((post) => (
          <div key={post.postId}>
            <GridCardPost post={post} />
          </div>
        ))}
      </div>
    </div>
  );
}
