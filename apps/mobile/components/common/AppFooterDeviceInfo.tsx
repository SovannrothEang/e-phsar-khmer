import { useDeviceInfo } from "@/hooks/useDeviceInfo";
import React from "react";
import { Text, View } from "react-native";

interface AppFooterDeviceInfoProps {
  username?: string;
  version?: string;
  className?: string;
  textClassName?: string;
}

export const AppFooterDeviceInfo: React.FC<AppFooterDeviceInfoProps> = ({
  username,
  version,
  className = "items-center mt-7 mb-8",
  textClassName = "text-center text-xs text-neutral-text-muted font-medium",
}) => {
  const {
    version: detectedVersion,
    deviceLabel,
    ipAddress,
  } = useDeviceInfo(version);

  return (
    <View className={className}>
      {username ? (
        <Text className={textClassName}>@{username.replace(/^@/, "")}</Text>
      ) : null}
      <Text className={textClassName}>
        Version: {version || detectedVersion}
      </Text>
      <Text className={`${textClassName} mt-0.5`}>{deviceLabel}</Text>
      <Text className={`${textClassName} mt-0.5`}>{ipAddress}</Text>
    </View>
  );
};

export default AppFooterDeviceInfo;
