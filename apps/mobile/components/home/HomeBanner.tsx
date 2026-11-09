import type { AdvertisementBanner } from "@/lib/api/advertisements";
import { SITE_URL } from "@/lib/site";
import { Image } from "expo-image";
import { Linking, ScrollView, TouchableOpacity, View } from "react-native";
import { useState } from "react";

interface HomeBannerProps {
  banners: AdvertisementBanner[];
  /** True until the banner query settles — reserves the 4:1 slot meanwhile. */
  isLoading?: boolean;
}

/**
 * Mobile deliberately shows the centre 75% of the banner: for a 3.88:1 admin
 * upload (e.g. 970×250) the matching slot is 2.91:1. The web storefront slot
 * stays 4:1. 4:1 shows the whole banner but is only 270 px tall on a 1080-wide
 * phone.
 */
const BANNER_ASPECT = 2.91;

/**
 * The home hero slot. Admin banners replace the bundled artwork when the slot
 * has active rows; a tap opens the banner's link when it has one.
 *
 * `expo-image`, not React Native's `Image`: admin banners can be animated WebP
 * (the current flag banner is), and RN's Android build has animated-WebP off —
 * it renders only the first frame.
 */
function HomeBanner({ banners, isLoading = false }: HomeBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Reserve the slot at its final ratio so a configured banner does not start
  // from the 2.2:1 fallback and then jump when the query resolves.
  if (isLoading) {
    return <View style={{ width: "100%", aspectRatio: BANNER_ASPECT }} />;
  }

  if (banners.length === 0) {
    return (
      <View style={{ width: "100%", aspectRatio: 640 / 290 }}>
        <Image
          source={require("@/assets/images/ai.gif")}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  const openBanner = (banner: AdvertisementBanner) => {
    if (!banner.linkUrl) return;
    // Admin banners can store a site-relative link ("/"); the phone needs an
    // absolute URL before the browser can take it.
    const target = banner.linkUrl.startsWith("/")
      ? `${SITE_URL}${banner.linkUrl}`
      : banner.linkUrl;
    Linking.openURL(target).catch(() => {
      /* no handler for the scheme */
    });
  };

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: BANNER_ASPECT,
        // `cover` on a banner that is not exactly 4:1 overflows the slot; keep
        // it inside instead of painting over the header/next section.
        overflow: "hidden",
      }}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <View style={{ width: "100%", height: "100%" }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: "100%", height: "100%" }}
          onScroll={(event) => {
            if (containerWidth <= 0) return;
            const next = Math.round(
              event.nativeEvent.contentOffset.x / containerWidth,
            );
            if (next !== activeIndex) setActiveIndex(next);
          }}
          scrollEventThrottle={16}
        >
          {banners.map((banner) => (
            <TouchableOpacity
              key={banner.id}
              activeOpacity={banner.linkUrl ? 0.9 : 1}
              onPress={() => openBanner(banner)}
              accessibilityLabel={banner.altText ?? "Advertisement"}
              style={{ width: containerWidth || "100%" }}
            >
              <Image
                source={{ uri: banner.imageUrl }}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {banners.length > 1 && (
          <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
            {banners.map((banner, index) => (
              <View
                key={`dot-${banner.id}`}
                className={`h-1.5 rounded-full ${
                  index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default HomeBanner;
