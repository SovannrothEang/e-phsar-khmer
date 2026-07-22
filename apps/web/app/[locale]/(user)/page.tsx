import CategoryGrid from "@/components/home/CategoryGrid";
import TopAds from "@/components/ads/TopAds";
import BrowseByLocation from "@/components/home/BrowseByLocation";
// import FeedbackButton from "@/components/ui/FeedBackButton";
import { Link } from "@/i18n/routing";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";

import { posts } from "@/lib/posts";
import { GridCardPost } from "@/components/ads/GridCardPost";
import { GridCardSell } from "@/components/ads/GridCardSell";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {

  const t = await getTranslations("HomePage");

  return (
    <>
    <main className="min-h-screen flex flex-col bg-muted">
      <div className="w-auto flex justify-center py-6">
        <div className="w-full max-w-4xl">
          <Link href="/" target="_blank">
            <AspectRatio ratio={4} className="bg-card overflow-hidden cusor-pointer">
              <Image
                src="/ads/flag-animation.gif"
                alt="Flag Ad"
                fill
                priority
                sizes="100vw"
                unoptimized
                className="object-cover"
              />
            </AspectRatio>
          </Link>
        </div>
      </div>

      <div className="px-6 py-8 md:px-12 md:py-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <h1 className="text-xl  text-foreground">{t("welcome.title")}</h1>
          <CategoryGrid />
          <TopAds />
          <h2 className="text-xl">{t("latestads")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <GridCardSell />
            {posts.map((post) => (
              <GridCardPost key={post.postId} post={post} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <Link
          href="/all-ads"
          className="w-5xl max-w-5xl px-6 py-2 bg-[#00a7e1] hover:bg-[#0095ca] text-s text-white text-center font-medium  rounded transition-colors"
        >
          {t("viewall")}
        </Link>
      </div>
      <div className="flex justify-center py-6 pb-30">
        <div className="w-full max-w-7xl">
          <BrowseByLocation />
        </div>
      </div>
      {/* <FeedbackButton /> */}
    </main>
    </>
  );
}
