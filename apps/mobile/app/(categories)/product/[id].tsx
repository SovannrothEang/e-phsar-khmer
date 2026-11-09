import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useReactions } from "@/contexts/ReactionsContext";
import { ApiError } from "@/lib/api/client";
import { fetchCategories, fetchListing } from "@/lib/api/listings";
import { fetchFollowStatus, followUser, unfollowUser } from "@/lib/api/users";
import {
  basePrice,
  buildSpecRows,
  finalPrice,
  formatListingDate,
  formatMoney,
  listingShareUrl,
  mapsUrl,
  maskEmail,
} from "@/lib/listings";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { setStringAsync } from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { isAuthenticated, user } = useAuth();
  const { isLiked, isSaved, likeCountFor, toggleLike, toggleSave } =
    useReactions();

  const listingQuery = useQuery({
    queryKey: ["listing", id],
    queryFn: () => fetchListing(id as string),
    enabled: !!id,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  const listing = listingQuery.data;

  const insets = useSafeAreaInsets();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [revealedPhones, setRevealedPhones] = useState<number[]>([]);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [pendingFollow, setPendingFollow] = useState(false);

  const followQuery = useQuery({
    queryKey: ["follow-status", listing?.userId],
    queryFn: () => fetchFollowStatus(listing!.userId),
    enabled: isAuthenticated && !!listing?.userId,
  });
  // The follow button mirrors the fetched follow status. It is derived from
  // query data, so it is synced during render instead of from an effect.
  const followData = followQuery.data;
  const [syncedFollow, setSyncedFollow] = useState(followData);
  if (followData && followData !== syncedFollow) {
    setSyncedFollow(followData);
    setFollowing(followData.following);
  }

  const images = useMemo(() => {
    const photos = [...(listing?.photos ?? [])].sort((a, b) => a.sort - b.sort);
    return photos.map((photo) => photo.url).filter(Boolean);
  }, [listing]);

  const category = categoriesQuery.data?.find(
    (entry) => entry.id === listing?.categoryId,
  );
  const subcategory = category?.subcategories?.find(
    (entry) => entry.id === listing?.subcategoryId,
  );

  if (listingQuery.isLoading) {
    return (
      <SafeAreaView className="bg-neutral-surface">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
          <Text className="mt-3 text-neutral-text-sub">Loading ad…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    const notFound =
      listingQuery.error instanceof ApiError &&
      listingQuery.error.status === 404;
    return (
      <SafeAreaView className="bg-neutral-surface">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center p-4">
          <Ionicons name="alert-circle-outline" size={44} color="#9CA3AF" />
          <Text className="mt-3 text-neutral-text-sub">
            {notFound ? "Product not found" : "Could not load this ad"}
          </Text>
          {!notFound && (
            <TouchableOpacity
              onPress={() => listingQuery.refetch()}
              className="mt-4 rounded-lg border border-primary px-6 py-2"
            >
              <Text className="font-bold text-primary">Try again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-3 rounded-lg bg-primary px-6 py-2"
          >
            <Text className="font-bold text-white">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isExpired = listing.status === "expired";
  const liked = isLiked(listing.id);
  const saved = isSaved(listing.id);
  const likeCount = likeCountFor(listing.id, listing.likeCount ?? 0);
  const base = basePrice(listing);
  const final = finalPrice(listing);
  const discounted = base !== null && final !== null && final < base;
  const discountValue = Number(listing.discountValue ?? 0);
  const priceLabel = final === null ? "Negotiable" : formatMoney(final);
  const publishedLabel = formatListingDate(
    listing.publishedAt ?? listing.createdAt,
  );
  const locationLabel = [listing.address, listing.location]
    .filter(Boolean)
    .join(", ");
  // Section one shows the province only, not the address/district/commune.
  const provinceOnly = listing.location?.split(",")[0]?.trim() || "";
  const shareUrl = listingShareUrl(listing);
  const mapLink = mapsUrl(listing);
  // Always offer the map: fall back to a search of the written location.
  const mapTarget =
    mapLink ??
    (locationLabel
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          locationLabel,
        )}`
      : null);
  const specRows = buildSpecRows(listing, category?.name, subcategory?.name);
  const sellerName =
    listing.contactName ||
    (listing.sellerUsername ? `@${listing.sellerUsername}` : "Seller");
  const sellerInitial = sellerName.replace("@", "").charAt(0).toUpperCase();
  const isSelfSeller =
    !!user?.username &&
    !!listing.sellerUsername &&
    user.username === listing.sellerUsername;

  const toggleFollowSeller = async () => {
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (pendingFollow) return;
    setPendingFollow(true);
    try {
      if (following) {
        await unfollowUser(listing.userId);
        setFollowing(false);
      } else {
        await followUser(listing.userId);
        setFollowing(true);
      }
    } catch (error) {
      Alert.alert(
        "Could not update follow",
        error instanceof ApiError ? error.message : "Please try again.",
      );
    } finally {
      setPendingFollow(false);
    }
  };

  const handleContact = (type: "call" | "email", value?: string | null) => {
    if (!value) return;
    const url = type === "call" ? `tel:${value}` : `mailto:${value}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Could not open", "No app can handle this action.");
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: shareUrl });
    } catch {
      /* user dismissed */
    }
  };

  const handleCopyLink = async () => {
    await setStringAsync(shareUrl);
    if (Platform.OS === "android") {
      ToastAndroid.show("Link copied!", ToastAndroid.SHORT);
    } else {
      Alert.alert("Copied", "Link copied to clipboard");
    }
    setShareModalVisible(false);
  };

  const handleReport = () => {
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }
    router.push({
      pathname: "/report/[id]",
      params: { id: listing.id, title: listing.title },
    });
  };

  return (
    <View className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* Header: floating actions over the gallery, blue bar once scrolled */}
      {scrolled ? (
        <View
          className="absolute left-0 right-0 top-0 z-20 bg-primary"
          style={{ paddingTop: insets.top }}
        >
          <View className="h-16 flex-row items-center gap-2.5 px-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="h-11 w-11 items-center justify-center overflow-hidden rounded bg-white/20">
              {images[0] ? (
                <Image
                  source={{ uri: images[0] }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="image-outline" size={20} color="white" />
              )}
            </View>
            <View className="flex-1">
              <Text
                className="text-sm font-semibold text-white"
                numberOfLines={1}
              >
                {listing.title}
              </Text>
              <Text className="mt-0.5 text-base font-bold text-white">
                {priceLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => void toggleSave(listing.id)}
              className="p-1"
            >
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={22}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShareModalVisible(true)}
              className="p-1"
            >
              <Ionicons name="share-social-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View
          className="absolute left-0 right-0 z-10 flex-row justify-between px-4"
          style={{ top: insets.top + 8 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="rounded-full bg-black/30 p-2 backdrop-blur-md"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleReport}
              className="rounded-full bg-black/30 p-2 backdrop-blur-md"
            >
              <Ionicons name="flag-outline" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void toggleSave(listing.id)}
              className="rounded-full bg-black/30 p-2 backdrop-blur-md"
            >
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={24}
                color={saved ? "#38BDF8" : "white"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void toggleLike(listing.id)}
              className="rounded-full bg-black/30 p-2 backdrop-blur-md"
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={24}
                color={liked ? "#EF4444" : "white"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShareModalVisible(true)}
              className="rounded-full bg-black/30 p-2 backdrop-blur-md"
            >
              <Ionicons name="share-social-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next =
            event.nativeEvent.contentOffset.y > Math.round(width) - 80;
          if (next !== scrolled) setScrolled(next);
        }}
      >
        {/* Expired notice */}
        {isExpired && (
          <View className="mt-24 mx-4 rounded-xl border border-amber-300 bg-amber-50 p-3 flex-row items-center gap-2">
            <Ionicons name="time-outline" size={18} color="#B45309" />
            <Text className="flex-1 text-xs font-semibold text-amber-800">
              This ad has expired. Contact details are no longer available.
            </Text>
          </View>
        )}

        {/* Gallery: main image + thumbnails */}
        <View className={isExpired ? "mt-2" : ""}>
          <View
            style={{ width, height: Math.round(width) }}
            className="relative bg-neutral-background"
          >
            {images.length > 0 ? (
              <Image
                source={{ uri: images[activeImageIndex] }}
                style={{ width, height: Math.round(width) }}
                resizeMode="cover"
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-neutral-background">
                <Ionicons
                  name="image-outline"
                  size={48}
                  color={Colors.text.muted}
                />
                <Text className="mt-2 text-neutral-text-muted">
                  No Image Available
                </Text>
              </View>
            )}
            {/* Dim the top so the status bar stays visible over white photos */}
            <LinearGradient
              colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]}
              pointerEvents="none"
              className="absolute left-0 right-0 top-0 h-28"
            />
          </View>

          {images.length > 1 ? (
            <View className="flex-row gap-1 bg-neutral-surface p-1">
              {images.length <= 3 ? (
                images.map((uri, index) => (
                  <TouchableOpacity
                    key={`thumb-${uri}-${index}`}
                    onPress={() => setActiveImageIndex(index)}
                    activeOpacity={0.8}
                    className="flex-1"
                  >
                    <Image
                      source={{ uri }}
                      style={{ width: "100%", aspectRatio: 1 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))
              ) : (
                <>
                  {[0, 1].map((index) => (
                    <TouchableOpacity
                      key={`thumb-${images[index]}-${index}`}
                      onPress={() => setActiveImageIndex(index)}
                      activeOpacity={0.8}
                      className="flex-1"
                    >
                      <Image
                        source={{ uri: images[index] }}
                        style={{ width: "100%", aspectRatio: 1 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => setViewerOpen(true)}
                    activeOpacity={0.8}
                    className="relative flex-1"
                  >
                    <Image
                      source={{ uri: images[2] }}
                      style={{ width: "100%", aspectRatio: 1 }}
                      resizeMode="cover"
                    />
                    <View className="absolute inset-0 items-center justify-center bg-black/55">
                      <Text className="text-lg font-bold text-white">
                        +{images.length - 3}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* Section one: name, province + date, price */}
        <View className="bg-neutral-surface px-4 py-4">
          <Text className="text-xl font-bold text-neutral-text-main leading-7">
            {listing.title}
          </Text>

          <Text className="mt-1 text-base text-neutral-text-sub">
            {[provinceOnly, publishedLabel].filter(Boolean).join(" - ")}
          </Text>

          <View className="mt-2 flex-row items-center gap-2 flex-wrap">
            <Text className="text-2xl font-bold text-danger">{priceLabel}</Text>
            {discounted && base !== null && (
              <Text className="text-sm text-neutral-text-muted line-through">
                {formatMoney(base)}
              </Text>
            )}
            {discounted && discountValue > 0 && (
              <View className="rounded-full bg-danger/10 px-2 py-0.5">
                <Text className="text-[11px] font-bold text-danger">
                  {listing.discountType === "percent"
                    ? `${discountValue}% OFF`
                    : `${formatMoney(discountValue)} OFF`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Gray divider between section one and section two */}
        <View className="h-2 bg-neutral-border" />

        {/* Section two: specs, description, contact, location + map */}
        <View className="bg-neutral-surface">
          {specRows.length > 0 && (
            <View className="px-4 py-3">
              {specRows.map((row, index) => (
                <Text
                  key={`${row.label}-${index}`}
                  className="mb-1 text-base text-neutral-text-main"
                >
                  {row.label}: {row.value}
                </Text>
              ))}
            </View>
          )}

          <View className="px-4 py-3">
            <Text className="text-base leading-6 text-neutral-text-main">
              {listing.description?.trim() || "No description provided."}
            </Text>
          </View>

          {/* Contact */}
          {!isExpired && (
            <View className="px-4 py-3">
              <Text className="font-bold text-neutral-text-main mb-2">
                Contact Info:
              </Text>
              <Text className="text-neutral-text-sub mb-4">
                Please don&apos;t forget to mention that you found this ad on
                PhsarKhmer.
              </Text>

              {listing.contactPhones.map((phone, index) => {
                const isRevealed = revealedPhones.includes(index);
                const maskedPhone =
                  phone.length > 3
                    ? phone.substring(0, phone.length - 3) + "XXX"
                    : phone;

                return (
                  <View
                    key={`${phone}-${index}`}
                    className="flex-row items-center mb-2"
                  >
                    <View className="w-6 h-6 bg-secondary-orange rounded flex items-center justify-center mr-2">
                      <Ionicons name="call" size={14} color="white" />
                    </View>
                    <Text className="text-lg font-medium text-neutral-text-main mr-2">
                      {isRevealed ? phone : maskedPhone}
                    </Text>
                    {!isRevealed ? (
                      <TouchableOpacity
                        onPress={() =>
                          setRevealedPhones((prev) => [...prev, index])
                        }
                      >
                        <Text className="text-primary underline text-sm italic">
                          Click to Show
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleContact("call", phone)}
                      >
                        <Text className="text-primary underline text-sm italic">
                          Call Now
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {listing.contactEmail && (
                <View className="flex-row items-center mt-1">
                  <View className="w-6 h-6 bg-primary rounded flex items-center justify-center mr-2">
                    <Ionicons name="mail" size={14} color="white" />
                  </View>
                  <Text className="text-lg font-medium text-neutral-text-main mr-2">
                    {emailRevealed
                      ? listing.contactEmail
                      : maskEmail(listing.contactEmail)}
                  </Text>
                  {!emailRevealed ? (
                    <TouchableOpacity onPress={() => setEmailRevealed(true)}>
                      <Text className="text-primary underline text-sm italic">
                        Click to Show
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() =>
                        handleContact("email", listing.contactEmail)
                      }
                    >
                      <Text className="text-primary underline text-sm italic">
                        Send Email
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Location + map */}
          {(locationLabel || mapTarget) && (
            <View className="px-4 py-3">
              {locationLabel ? (
                <View className="flex-row">
                  <Ionicons
                    name="location-sharp"
                    size={24}
                    color={Colors.text.muted}
                    style={{ marginTop: 2 }}
                  />
                  <View className="ml-2 flex-1">
                    <Text className="text-base font-medium text-neutral-text-main">
                      Location:{" "}
                      <Text className="font-normal">{locationLabel}</Text>
                    </Text>
                  </View>
                </View>
              ) : null}

              {mapTarget ? (
                <View className="mt-4 h-48 w-full items-center justify-center overflow-hidden rounded-lg">
                  <Image
                    source={require("@/assets/images/map_placeholder.png")}
                    className="absolute h-full w-full"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => Linking.openURL(mapTarget)}
                    className="flex-row items-center rounded-full bg-neutral-surface px-4 py-2.5 shadow-sm"
                  >
                    <Ionicons name="map" size={20} color={Colors.danger} />
                    <Text className="ml-2 font-medium text-neutral-text-main">
                      Show Location on Map
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Gray divider before the poster profile */}
        <View className="h-2 bg-neutral-border" />

        {/* Seller — plain section like the reference, no card */}
        <View className="bg-neutral-surface px-4 py-4">
          <View className="flex-row items-center">
            <View className="mr-3 h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#00A0E9]">
              <Text className="text-xl font-semibold text-white">
                {sellerInitial || "S"}
              </Text>
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-lg font-bold text-neutral-text-main">
                  {sellerName}
                </Text>
                {listing.sellerVerifiedAccount && (
                  <Ionicons
                    name="checkmark-circle"
                    size={17}
                    color={Colors.primary.DEFAULT}
                  />
                )}
              </View>
              {listing.sellerUsername ? (
                <Text className="mt-0.5 text-sm text-neutral-text-sub">
                  @{listing.sellerUsername}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="mt-4 flex-row gap-3">
            {listing.sellerUsername ? (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/user/${listing.sellerUsername}` as never)
                }
                className="flex-1 items-center justify-center rounded-lg bg-[#DCEEF8] py-3"
                activeOpacity={0.7}
              >
                <Text className="text-base font-semibold text-primary">
                  View Profile
                </Text>
              </TouchableOpacity>
            ) : null}
            {!isSelfSeller ? (
              <TouchableOpacity
                onPress={() => void toggleFollowSeller()}
                disabled={pendingFollow}
                className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-primary py-3"
                activeOpacity={0.7}
              >
                <Ionicons
                  name={following ? "checkmark" : "add"}
                  size={18}
                  color={Colors.primary.DEFAULT}
                />
                <Text className="text-base font-semibold text-primary">
                  {following ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-neutral-surface border-t border-neutral-border/80 px-4 py-3 flex-row items-center gap-3 shadow-lg">
        <TouchableOpacity
          className="items-center justify-center rounded-xl bg-neutral-background px-3 py-1"
          activeOpacity={0.7}
          onPress={() => void toggleLike(listing.id)}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={22}
            color={liked ? Colors.danger : Colors.text.sub}
          />
          <Text className="mt-0.5 text-[10px] font-medium text-neutral-text-sub">
            {likeCount}
          </Text>
        </TouchableOpacity>

        {!isExpired && listing.contactPhones.length > 0 && (
          <TouchableOpacity
            className="flex-1 bg-primary rounded-xl items-center justify-center flex-row gap-2 py-3.5 shadow-sm"
            onPress={() => handleContact("call", listing.contactPhones[0])}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={18} color="white" />
            <Text className="text-white font-bold text-sm">Call</Text>
          </TouchableOpacity>
        )}

        {!isExpired && (
          <TouchableOpacity
            className="flex-1 bg-secondary-orange rounded-xl items-center justify-center flex-row gap-2 py-3.5 shadow-sm"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/chat",
                params: { userId: listing.userId, listingId: listing.id },
              } as never)
            }
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="white" />
            <Text className="text-white font-bold text-sm">Chat</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Share Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shareModalVisible}
        onRequestClose={() => setShareModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          className="flex-1 bg-black/60 justify-end"
          activeOpacity={1}
          onPress={() => setShareModalVisible(false)}
        >
          <View className="w-full">
            <View className="items-center mb-3">
              <View className="w-12 h-1.5 bg-white/95 rounded-full" />
            </View>

            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              className="bg-neutral-background rounded-t-3xl p-4 w-full pb-8"
            >
              {/* Preview card */}
              <View
                className="bg-neutral-surface rounded-2xl overflow-hidden p-3 shadow-md mb-6 border border-neutral-border/50"
                style={{
                  elevation: 3,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                }}
              >
                <View className="rounded-xl overflow-hidden mb-3 gap-[2px]">
                  <View className="h-44 w-full bg-neutral-background">
                    {images[0] ? (
                      <Image
                        source={{ uri: images[0] }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons
                          name="image-outline"
                          size={36}
                          color={Colors.text.muted}
                        />
                      </View>
                    )}
                  </View>

                  {images.length > 1 && (
                    <View className="flex-row h-20 gap-[2px]">
                      {[1, 2, 3].map((slot) => (
                        <View
                          key={slot}
                          className="flex-1 bg-neutral-background relative"
                        >
                          <Image
                            source={{
                              uri: images[slot] || images[0],
                            }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                          {slot === 3 && images.length > 4 && (
                            <View className="absolute inset-0 bg-black/40 items-center justify-center">
                              <Text className="text-white text-base font-bold">
                                +{images.length - 3}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View className="flex-row justify-between px-1 py-1">
                  <View className="flex-1 mr-3 justify-between">
                    <View>
                      <View className="flex-row items-center mb-1.5">
                        <View className="w-6 h-6 rounded-full bg-neutral-background items-center justify-center mr-2 border border-neutral-border">
                          <Text className="text-[10px] font-bold text-neutral-text-sub">
                            {sellerInitial || "S"}
                          </Text>
                        </View>
                        <Text className="text-neutral-text-sub text-xs font-semibold">
                          {sellerName}
                        </Text>
                      </View>

                      <Text
                        className="text-[15px] font-bold text-neutral-text-main leading-5 mb-1"
                        numberOfLines={2}
                      >
                        {listing.title}
                      </Text>

                      <Text
                        className="text-neutral-text-sub text-[10px] mb-1.5 font-medium"
                        numberOfLines={1}
                      >
                        {listing.contactPhones[0]
                          ? `${listing.contactPhones[0]} • `
                          : ""}
                        {locationLabel}
                      </Text>
                    </View>

                    <Text className="text-danger text-lg font-bold">
                      {priceLabel}
                    </Text>
                  </View>

                  <View className="w-20 h-20 bg-white p-1 border border-neutral-border rounded-lg relative self-end mb-1">
                    <Image
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`,
                      }}
                      className="w-full h-full"
                    />
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View className="flex-row justify-around w-full mt-2 mb-2 px-2">
                <TouchableOpacity
                  onPress={handleCopyLink}
                  className="items-center"
                >
                  <View className="w-14 h-14 rounded-full bg-neutral-border items-center justify-center mb-2">
                    <Ionicons
                      name="link-outline"
                      size={24}
                      color={Colors.text.primary}
                    />
                  </View>
                  <Text className="text-neutral-text-sub text-xs font-semibold">
                    Copy link
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShare}
                  className="items-center"
                >
                  <View className="w-14 h-14 rounded-full bg-neutral-border items-center justify-center mb-2">
                    <Ionicons
                      name="arrow-redo-outline"
                      size={24}
                      color={Colors.text.primary}
                    />
                  </View>
                  <Text className="text-neutral-text-sub text-xs font-semibold">
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-screen photo viewer */}
      <Modal
        visible={viewerOpen}
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View className="flex-1 bg-black">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: width * 2, y: 0 }}
            className="flex-1"
          >
            {images.map((uri, index) => (
              <Image
                key={`viewer-${uri}-${index}`}
                source={{ uri }}
                style={{ width, height: "100%" }}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={() => setViewerOpen(false)}
            className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-black/40"
            style={{ top: insets.top + 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close photos"
          >
            <Ionicons name="close" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
