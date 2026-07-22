
import { Link } from "@/i18n/routing";
import Image from "next/image";
import HighLightAds from "@/components/ads/HighLightAds";
import NormalAd from "@/components/ads/NormalAd";
import { AspectRatio } from "@/components/ui/aspect-ratio"
import AdsPhoto from "@/components/ads/AdsPhoto";
import { IconHome,IconChevronRightFilled } from '@tabler/icons-react';
import AllAdsHeader from "@/components/all-ads/AllAdsHeader";

export default function AllAdsPage() {

  return (
    
    <main className="min-h-screen flex flex-col bg-muted">
      <div className="w-full flex justify-center py-6">
        <div className="w-full max-w-4xl">
          <Link href="/" target="_blank">
            <AspectRatio ratio={4} className="bg-background rounded-none cursor-pointer">
              <Image
                src="/ads/flag-animation.gif"
                alt="Photo"
                fill
                priority
                className="object-cover rounded-none"
              />
            </AspectRatio>
          </Link>
        </div>
      </div>
      <div className="px-4 py-2">
        <div className="max-w-7xl mx-auto w-full pb-2">
          <nav className="flex items-center gap-2 text-base">
            <Link
              href="/"
              className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:text-blue-300">
              <IconHome size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300" />
              <span className="text-gray-500 dark:text-gray-400 group-hover:text-blue-300 pl-1.5">Home</span>
            </Link>
            <IconChevronRightFilled size={16} className="block mt-1 text-gray-500" />
            <h1 className="text-gray-500 dark:text-gray-400">All Ads in Cambodia</h1>
          </nav>
        </div>
      </div> 
      <div className="max-w-7xl mx-auto w-full pb-2">
      <AllAdsHeader />
        {/* <CategoryGridSmall />
        <NormalAd />
        <NormalAd /> */}
        {/* <NormalAd /> */}
        <AdsPhoto />
        <HighLightAds />
        <AdsPhoto />
        <HighLightAds />
      </div>
    </main>
  );
}
