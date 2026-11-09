import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ModelItem {
  id: string;
  name: string;
}

interface ModelGridProps {
  /** Every model of the brand — the grid shows the first `initialCount`. */
  models: ModelItem[];
  /** Model name currently filtered on, highlighted in the grid. */
  selectedName?: string;
  onModelPress?: (model: ModelItem) => void;
  /** Opens the searchable slide-up list; omitted when everything is shown. */
  onShowMore?: () => void;
  /**
   * 8 by default: the "Model:" label takes the first cell, so 8 models fill
   * exactly three rows of three.
   */
  initialCount?: number;
}

const ModelGrid = ({
  models,
  selectedName,
  onModelPress,
  onShowMore,
  initialCount = 8,
}: ModelGridProps) => {
  if (models.length === 0) return null;

  const visibleModels = models.slice(0, initialCount);

  return (
    <View className="px-4 pt-2 pb-2">
      <View className="flex-row flex-wrap">
        {/* Model Label */}
        <View className="w-1/3 mb-4">
          <Text className="text-base text-neutral-text-muted">Model:</Text>
        </View>

        {visibleModels.map((model) => {
          const isSelected = model.name === selectedName;
          return (
            <TouchableOpacity
              key={model.id}
              className="w-1/3 mb-4"
              onPress={() => onModelPress?.(model)}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className={`w-full pr-2 text-base ${
                  isSelected
                    ? "text-primary font-semibold"
                    : "text-neutral-text-main"
                }`}
              >
                {model.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {onShowMore && models.length > initialCount && (
        <TouchableOpacity
          onPress={onShowMore}
          className="flex-row items-center justify-center py-2"
        >
          <Text className="text-primary mr-1 font-medium">Show More</Text>
          <Ionicons
            name="chevron-down"
            size={18}
            color={Colors.primary.DEFAULT}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ModelGrid;
