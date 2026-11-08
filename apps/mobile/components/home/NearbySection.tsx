import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

/**
 * "Nearby" promo block: a light-blue section between gray bands. The map image
 * covers the whole card, the location arrow sits in the middle and the prompt
 * fades in over the bottom of the image (captain's reference, 2026-11-04).
 */
const NearbySection = () => {
  return (
    <View className="bg-neutral-border py-3 dark:bg-gray-950">
      <View className="bg-[#E6F4FB] px-4 pb-5 pt-5 dark:bg-gray-900">
        <View className="mb-3 flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-gray-800">
            <Ionicons name="navigate" size={18} color="#111827" />
          </View>
          <Text className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Nearby
          </Text>
        </View>

        <View className="overflow-hidden rounded-xl bg-white dark:bg-gray-800">
          <View style={{ height: 240 }} className="items-center justify-center">
            <Image
              source={require("@/assets/images/map_placeholder.png")}
              className="absolute h-full w-full"
              resizeMode="cover"
            />

            {/* Icon + prompt + button, centred together on the map */}
            <View className="items-center px-6">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-sky-400/25">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-sky-500 shadow-md">
                  <Ionicons name="navigate" size={30} color="white" />
                </View>
              </View>

              <Text className="mt-4 text-center text-base leading-6 text-gray-700">
                Enable your location to show the listings near you.
              </Text>

              <TouchableOpacity
                activeOpacity={0.8}
                className="mt-4 rounded-lg bg-[#DCEEF8] px-6 py-3"
              >
                <Text className="text-base font-semibold text-sky-600">
                  Allow Location Access
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

export default NearbySection;
