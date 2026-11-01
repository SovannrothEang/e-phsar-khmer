import { FeedScrollView } from "@/components/category/FeedScrollView";
import ListingFeed from "@/components/category/ListingFeed";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchFollowStatus,
  fetchPublicProfile,
  followUser,
  unfollowUser,
} from "@/lib/api/users";
import { formatListingDate } from "@/lib/listings";
import { SITE_URL } from "@/lib/site";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const ProfileScreen = () => {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const username = Array.isArray(params.id) ? params.id[0] : params.id;
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"Home" | "About">("Home");

  const profileQuery = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => fetchPublicProfile(username as string),
    enabled: !!username,
  });
  const profile = profileQuery.data;

  const followQuery = useQuery({
    queryKey: ["follow-status", profile?.id],
    queryFn: () => fetchFollowStatus(profile!.id),
    enabled: isAuthenticated && !!profile?.id,
  });

  const [following, setFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [pendingFollow, setPendingFollow] = useState(false);

  useEffect(() => {
    setFollowing(null);
    setFollowerCount(null);
  }, [username]);

  useEffect(() => {
    if (followQuery.data) setFollowing(followQuery.data.following);
  }, [followQuery.data]);

  const isFollowing = following ?? followQuery.data?.following ?? false;
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

  return (
    <View className="flex-1 bg-neutral-background">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient
        colors={["#5bbdf5", "#dceffa"]}
        className="absolute left-0 top-0 h-40 w-full"
      />

      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-2">
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

        <FeedScrollView
          className="mt-4 flex-1"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4">
            <View className="flex-row items-end justify-between">
              <View className="relative">
                {profile.profilePhotoUrl ? (
                  <Image
                    source={{ uri: profile.profilePhotoUrl }}
                    className="h-24 w-24 rounded-full border-4 border-neutral-surface"
                  />
                ) : (
                  <View className="h-24 w-24 items-center justify-center rounded-full border-4 border-neutral-surface bg-primary/10">
                    <Text className="text-3xl font-bold text-primary">
                      {initial}
                    </Text>
                  </View>
                )}
              </View>

              {!isSelf && (
                <TouchableOpacity
                  onPress={toggleFollow}
                  disabled={pendingFollow}
                  className={`flex-row items-center gap-1.5 rounded-lg px-6 py-2 shadow-sm ${
                    isFollowing
                      ? "border border-primary/40 bg-neutral-surface"
                      : "bg-neutral-surface"
                  }`}
                >
                  <Ionicons
                    name={isFollowing ? "checkmark" : "add"}
                    size={18}
                    color={Colors.primary.DEFAULT}
                  />
                  <Text className="font-bold text-primary">
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

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
                <Text className="font-normal text-neutral-text-sub">
                  Followers
                </Text>
              </Text>
              <Text className="font-bold text-neutral-text-main">
                {profile.following}{" "}
                <Text className="font-normal text-neutral-text-sub">
                  Following
                </Text>
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
              <Ionicons
                name="calendar-outline"
                size={16}
                color={Colors.text.muted}
              />
              <Text className="text-neutral-text-sub">
                Joined {formatListingDate(profile.createdAt)}
              </Text>
            </View>

            <View className="mb-4 mt-6 flex-row gap-3">
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
          </View>

          <View className="mt-2 flex-row border-b border-neutral-border">
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
            <View className="min-h-screen bg-neutral-background pb-10">
              <View className="flex-row items-center justify-between px-4 py-4">
                <Text className="text-lg font-bold text-neutral-text-main">
                  Recent Ads
                </Text>
              </View>
              <ListingFeed
                query={{ userId: profile.id, limit: 20 }}
                viewMode="grid"
                emptyLabel="No active ads yet."
              />
            </View>
          ) : (
            <View className="mt-4 gap-3 px-4">
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
        </FeedScrollView>
      </SafeAreaView>
    </View>
  );
};

export default ProfileScreen;
