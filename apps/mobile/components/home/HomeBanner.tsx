import type { AdvertisementBanner } from "@/lib/api/advertisements";
import { SITE_URL } from "@/lib/site";
import {
  Image,
  Linking,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useState } from "react";

interface HomeBannerProps {
  banners: AdvertisementBanner[];
}

/**
 * The home hero slot. Admin banners replace the bundled artwork when the slot
 * has active rows; a tap opens the banner's link when it has one.
 */
function HomeBanner({ banners }: HomeBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  if (banners.length === 0) {
    return (
      <View className="px-3 pt-3">
        <View
          className="w-full overflow-hidden rounded-3xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
          style={{
            elevation: 4,
            shadowColor: "#0EA5E9",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
          }}
        >
          <View style={{ width: "100%", aspectRatio: 640 / 290 }}>
            <Image
              source={require("@/assets/images/ai.gif")}
              resizeMode="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
        </View>
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
    <View className="px-3 pt-3">
      <View
        className="w-full overflow-hidden rounded-3xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
        style={{
          elevation: 4,
          shadowColor: "#0EA5E9",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        }}
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      >
        <View style={{ width: "100%", aspectRatio: 640 / 290 }}>
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
                  resizeMode="cover"
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
    </View>
  );
}

export default HomeBanner;
