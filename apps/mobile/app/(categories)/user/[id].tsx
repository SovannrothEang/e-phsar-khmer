import { FeedScrollView } from "@/components/category/FeedScrollView";
import ListingFeed from "@/components/category/ListingFeed";
import SelectionSheet from "@/components/common/SelectionSheet";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProvinces } from "@/lib/api/catalog";
import {
  fetchFollowStatus,
  fetchPublicProfile,
  followUser,
  unfollowUser,
} from "@/lib/api/users";
import {
  feedQueryFromParams,
  firstParam,
  pickFilterParams,
} from "@/lib/feed-params";
import { formatListingDate } from "@/lib/listings";
import { SITE_URL } from "@/lib/site";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const username = firstParam(params.id);
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"Home" | "About">("Home");
  const [scrolled, setScrolled] = useState(false);
  // The filter screen hands the keyword back too, so a filtered remount keeps
  // whatever the visitor had typed in the search bar.
  const initialQuery = firstParam(params.q) ?? "";
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [locationOpen, setLocationOpen] = useState(false);

  // Filters live in the route params so the filter screen can hand them back
  // (the same contract the category feeds use) and the badge stays in sync.
  const filterParams = useMemo(() => feedQueryFromParams(params), [params]);
  const provinceSlug = filterParams.provinceSlug ?? "";

  const profileQuery = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => fetchPublicProfile(username as string),
    enabled: !!username,
  });
  const profile = profileQuery.data;
  const provincesQuery = useQuery({
    queryKey: ["provinces"],
    queryFn: fetchProvinces,
    staleTime: 10 * 60_000,
  });
  const provinceName = useMemo(
    () =>
      (provincesQuery.data ?? []).find(
        (province) => province.slug === provinceSlug,
      )?.name ?? provinceSlug,
    [provincesQuery.data, provinceSlug],
  );
  // Location counts once however deep it goes; price counts as one row.
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterParams.postedWithin) count += 1;
    if (
      filterParams.provinceSlug ||
      filterParams.districtSlug ||
      filterParams.communeSlug
    ) {
      count += 1;
    }
    if (filterParams.minPrice || filterParams.maxPrice) count += 1;
    if (filterParams.sort && filterParams.sort !== "newest") count += 1;
    return count;
  }, [filterParams]);
  const feedQuery = useMemo(
    () => ({
      userId: profile?.id,
      limit: 20,
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...filterParams,
    }),
    [profile?.id, debouncedSearch, filterParams],
  );

  // Debounce the keyword so the feed is not re-queried on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const followQuery = useQuery({
    queryKey: ["follow-status", profile?.id],
    queryFn: () => fetchFollowStatus(profile!.id),
    enabled: isAuthenticated && !!profile?.id,
  });

  const [following, setFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [pendingFollow, setPendingFollow] = useState(false);
  // Follow state is derived from the profile username and the follow query, so
  // both transitions are adjusted during render instead of from effects.
  const [syncedUsername, setSyncedUsername] = useState(username);
  if (username !== syncedUsername) {
    setSyncedUsername(username);
    setFollowing(null);
    setFollowerCount(null);
  }
  const followData = followQuery.data;
  const [syncedFollow, setSyncedFollow] = useState(followData);
  if (followData && followData !== syncedFollow) {
    setSyncedFollow(followData);
    setFollowing(followData.following);
  }

  const isFollowing = following ?? followData?.following ?? false;
  const followers = followerCount ?? profile?.followers ?? 0;

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.username ||
      "Seller"
    : "Seller";
  const initial = displayName.charAt(0).toUpperCase();
  const isSelf = !!profile?.username && profile.username === user.username;

  const toggleFollow = async () => {
    if (!profile) return;
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (isSelf || pendingFollow) return;

    const next = !isFollowing;
    setPendingFollow(true);
    setFollowing(next);
    setFollowerCount(followers + (next ? 1 : -1));

    try {
      if (next) await followUser(profile.id);
      else await unfollowUser(profile.id);
    } catch {
      setFollowing(!next);
      setFollowerCount(followers + (next ? -1 : 1));
    } finally {
      setPendingFollow(false);
    }
  };

  const handleShare = async () => {
    if (!profile?.username) return;
    try {
      await Share.share({ message: `${SITE_URL}/${profile.username}` });
    } catch {
      /* dismissed */
    }
  };

  const handleReport = () => {
    if (!profile) return;
    if (!isAuthenticated) {
      router.push("/(auth)/sign-in");
      return;
    }
    router.push({
      pathname: "/report/[id]",
      params: { id: profile.id, title: displayName, targetType: "user" },
    });
  };

  const openFilters = () => {
    if (!profile?.username) return;
    router.push({
      pathname: "/filters",
      params: {
        userId: profile.id,
        username: profile.username,
        ...(search.trim() ? { q: search.trim() } : {}),
        ...pickFilterParams(params),
      },
    } as never);
  };

  if (profileQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-background">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={Colors.primary.DEFAULT} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-background px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="person-circle-outline" size={48} color="#9CA3AF" />
        <Text className="mt-3 text-neutral-text-sub">Seller not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 rounded-lg bg-primary px-6 py-2"
        >
          <Text className="font-bold text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const followButton = !isSelf ? (
    <TouchableOpacity
      onPress={toggleFollow}
      disabled={pendingFollow}
      activeOpacity={0.7}
      className="flex-row items-center gap-1 px-2 py-1.5"
    >
      <Ionicons
        name={isFollowing ? "checkmark" : "add"}
        size={20}
        color={Colors.primary.DEFAULT}
      />
      <Text className="text-base font-bold text-primary">
        {isFollowing ? "Following" : "Follow"}
      </Text>
    </TouchableOpacity>
  ) : null;

  const profileInfo = (
    <>
      <View className="mt-3">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-2xl font-bold text-neutral-text-main">
            {displayName}
          </Text>
          {profile.isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={Colors.primary.DEFAULT}
            />
          )}
        </View>
        <Text className="text-neutral-text-sub">
          @{profile.username ?? "user"}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center gap-4">
        <Text className="font-bold text-neutral-text-main">
          {followers}{" "}
          <Text className="font-normal text-neutral-text-sub">Followers</Text>
        </Text>
        <Text className="font-bold text-neutral-text-main">
          {profile.following}{" "}
          <Text className="font-normal text-neutral-text-sub">Following</Text>
        </Text>
      </View>

      {profile.verifiedAccount && (
        <View className="mt-2 flex-row items-center gap-1">
          <Ionicons
            name="ribbon-outline"
            size={16}
            color={Colors.primary.DEFAULT}
          />
          <Text className="text-neutral-text-sub">Verified account</Text>
        </View>
      )}

      <View className="mt-2 flex-row items-center gap-2">
        <Ionicons name="calendar-outline" size={16} color={Colors.text.muted} />
        <Text className="text-neutral-text-sub">
          Joined {formatListingDate(profile.createdAt)}
        </Text>
      </View>
    </>
  );

  return (
    <View className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* Floating back/share over the cover or gradient */}
      {!scrolled ? (
        <View
          className="absolute left-0 right-0 z-20 flex-row items-center justify-between px-4"
          style={{ top: insets.top + 8 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/20"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/20"
          >
            <Ionicons name="share-social" size={20} color="white" />
          </TouchableOpacity>
        </View>
      ) : (
        <View
          className="absolute left-0 right-0 top-0 z-20 bg-primary"
          style={{ paddingTop: insets.top }}
        >
          <View className="h-14 flex-row items-center px-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <Text
              className="flex-1 text-center text-lg font-bold text-white"
              numberOfLines={1}
            >
              @{profile.username ?? "user"}
            </Text>
            <TouchableOpacity
              onPress={handleShare}
              className="h-10 w-10 items-center justify-center"
            >
              <Ionicons name="share-social" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FeedScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 120;
          if (next !== scrolled) setScrolled(next);
        }}
      >
        <>
          <View style={{ height: insets.top + 180 }}>
            {profile.coverPhotoUrl ? (
              <Image
                source={{ uri: profile.coverPhotoUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[
                  "rgba(0,160,233,0.10)",
                  "rgba(184,224,247,0.25)",
                  "rgba(0,160,233,0.05)",
                ]}
                className="h-full w-full"
              />
            )}
            <LinearGradient
              colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0)"]}
              className="absolute left-0 right-0 top-0 h-28"
            />
          </View>

          <View
            className="relative rounded-t-3xl bg-white px-4 dark:bg-gray-900"
            style={{ marginTop: -24, paddingTop: 52 }}
          >
            <View className="absolute -top-12 left-4">
              {profile.profilePhotoUrl ? (
                <Image
                  source={{ uri: profile.profilePhotoUrl }}
                  className="h-24 w-24 rounded-full border-4 border-white"
                />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#00A0E9]">
                  <Text className="text-3xl font-semibold text-white">
                    {initial}
                  </Text>
                </View>
              )}
            </View>

            {followButton ? (
              <View className="absolute right-4 top-4">{followButton}</View>
            ) : null}

            {profileInfo}
          </View>
        </>

        {/* White continuation: actions, tabs and the feed controls */}
        <View className="bg-white dark:bg-gray-900">
          <View className="flex-row gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <TouchableOpacity
              onPress={handleShare}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary py-3 shadow-sm"
            >
              <Ionicons name="share-social" size={20} color="white" />
              <Text className="text-base font-bold text-white">Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReport}
              className="h-12 w-12 items-center justify-center rounded-full border border-primary"
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={24}
                color={Colors.primary.DEFAULT}
              />
            </TouchableOpacity>
          </View>

          <View className="flex-row border-b border-gray-100 dark:border-gray-800">
            <TouchableOpacity
              onPress={() => setActiveTab("Home")}
              className={`flex-1 border-b-2 py-3 ${activeTab === "Home" ? "border-primary" : "border-transparent"}`}
            >
              <Text
                className={`text-center font-bold ${activeTab === "Home" ? "text-primary" : "text-neutral-text-sub"}`}
              >
                Home
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("About")}
              className={`flex-1 border-b-2 py-3 ${activeTab === "About" ? "border-primary" : "border-transparent"}`}
            >
              <Text
                className={`text-center font-bold ${activeTab === "About" ? "text-primary" : "text-neutral-text-sub"}`}
              >
                About Me
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "Home" ? (
            <>
              {/* Gray divider between the tabs and the search controls */}
              <View className="h-2 bg-neutral-border" />

              {/* Search + filters */}
              <View className="flex-row items-center gap-3 px-4 py-3">
                <View className="flex-1 flex-row items-center rounded-lg bg-gray-100 px-3 py-2.5 dark:bg-gray-800">
                  <Ionicons name="search" size={18} color="#9CA3AF" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="search"
                    className="ml-2 flex-1 p-0 text-base text-gray-900 dark:text-white"
                  />
                </View>
                <TouchableOpacity
                  onPress={openFilters}
                  accessibilityRole="button"
                  accessibilityLabel="Filters"
                  className="h-10 w-10 items-center justify-center"
                >
                  <View>
                    <Ionicons
                      name="options-outline"
                      size={24}
                      color="#374151"
                    />
                    {activeFilterCount > 0 ? (
                      <View className="absolute -right-2.5 -top-2 h-5 min-w-5 items-center justify-center rounded-full bg-secondary-orange px-1">
                        <Text className="text-[11px] font-bold text-white">
                          {activeFilterCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Location + grid/list toggle */}
              <View className="flex-row items-center justify-between px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => setLocationOpen(true)}
                    activeOpacity={0.7}
                    className="flex-row items-center gap-2"
                  >
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color="#374151"
                    />
                    <Text className="text-base text-gray-900 dark:text-white">
                      {provinceName || "All location"}
                    </Text>
                  </TouchableOpacity>
                  {provinceSlug ? (
                    <TouchableOpacity
                      onPress={() =>
                        router.setParams({
                          provinceSlug: "",
                          districtSlug: "",
                          communeSlug: "",
                        })
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Clear location"
                    >
                      <Ionicons name="close" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-4">
                  <TouchableOpacity
                    onPress={() => setViewMode("grid")}
                    accessibilityRole="button"
                    accessibilityLabel="Grid view"
                  >
                    <Ionicons
                      name="grid-outline"
                      size={22}
                      color={
                        viewMode === "grid" ? Colors.primary.DEFAULT : "#9CA3AF"
                      }
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setViewMode("list")}
                    accessibilityRole="button"
                    accessibilityLabel="List view"
                  >
                    <Ionicons
                      name="list-outline"
                      size={22}
                      color={
                        viewMode === "list" ? Colors.primary.DEFAULT : "#9CA3AF"
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View className="gap-3 px-4 py-4">
              <View className="flex-row justify-between">
                <Text className="text-neutral-text-sub">Username</Text>
                <Text className="font-medium text-neutral-text-main">
                  @{profile.username ?? "user"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-neutral-text-sub">Joined</Text>
                <Text className="font-medium text-neutral-text-main">
                  {formatListingDate(profile.createdAt)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-neutral-text-sub">Verified</Text>
                <Text className="font-medium text-neutral-text-main">
                  {profile.isVerified ? "Yes" : "No"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-neutral-text-sub">Followers</Text>
                <Text className="font-medium text-neutral-text-main">
                  {followers}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-neutral-text-sub">Following</Text>
                <Text className="font-medium text-neutral-text-main">
                  {profile.following}
                </Text>
              </View>
            </View>
          )}
        </View>

        {activeTab === "Home" ? (
          <>
            <View className="h-2 bg-neutral-border" />
            <View className="min-h-screen bg-white pb-10 pt-3 dark:bg-gray-950">
              <ListingFeed
                query={feedQuery}
                viewMode={viewMode}
                emptyLabel="No active ads yet."
              />
            </View>
          </>
        ) : null}
      </FeedScrollView>

      <SelectionSheet
        visible={locationOpen}
        title="Location"
        options={(provincesQuery.data ?? []).map((province) => ({
          id: province.slug,
          name: province.name,
        }))}
        value={provinceSlug}
        onSelect={(option) => {
          router.setParams({
            provinceSlug: option.id,
            districtSlug: "",
            communeSlug: "",
          });
          setLocationOpen(false);
        }}
        onClear={
          provinceSlug
            ? () => {
                router.setParams({
                  provinceSlug: "",
                  districtSlug: "",
                  communeSlug: "",
                });
                setLocationOpen(false);
              }
            : undefined
        }
        onClose={() => setLocationOpen(false)}
        emptyLabel="No locations"
        loading={provincesQuery.isLoading}
      />
    </View>
  );
};

export default ProfileScreen;
