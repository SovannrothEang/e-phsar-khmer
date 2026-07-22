import { TopPosts } from "@/lib/posts"
import { GridCardPost } from "./GridCardPost"
import { getTranslations } from "next-intl/server"

export default async function TopAds() {
  const t = await getTranslations("HomePage");
  return (

    <div className=" rounded bg-gradient-to-b from-[#00a0e9] from-0% via-[#00a0e9] via-[60px] to-card dark:from-primary-900 dark:to-black overflow-hidden">
      
      <h2 className="text-lg font-semibold pb-3 px-4 pt-3">
        {t('topads')}
      </h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 snap-x">
        {TopPosts.map((post) => (
        <div key={post.postId} >
        <GridCardPost post={post} />
      </div>
      ))}
      </div>
    </div>
  )
}