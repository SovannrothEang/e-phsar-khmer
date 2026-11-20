import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { SITE_URL } from "@/lib/site";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import QRCode from "react-native-qrcode-svg";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  Share,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  useAnimatedValue,
  useWindowDimensions,
  View,
  type AlertButton,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScanTabKey = "scan" | "mine";
type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface QrSvgRef {
  toDataURL: (callback: (data: string) => void) => void;
}

function toast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-1 items-center justify-center py-4"
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={`text-base ${
          active ? "font-bold text-gray-900" : "font-medium text-gray-500"
        }`}
      >
        {label}
      </Text>
      {active ? (
        <View className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary" />
      ) : null}
    </TouchableOpacity>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="items-center"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
        <Ionicons name={icon} size={24} color="#111827" />
      </View>
      <Text className="mt-2 text-sm text-gray-700">{label}</Text>
    </TouchableOpacity>
  );
}

/** Camera scanner with the "Align frame with QR code" panel. */
function ScanPanel() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const animationValue = useAnimatedValue(0);
  const frameSize = Math.min(width * 0.72, 300);

  useEffect(() => {
    if (!permission?.granted || scanned) return;
    animationValue.setValue(0);
    const loop = Animated.loop(
      Animated.timing(animationValue, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [permission?.granted, scanned, animationValue]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const productMatch = data.match(/\/product\/([a-zA-Z0-9_-]+)/);
    if (productMatch && productMatch[1]) {
      router.replace(`/(categories)/product/${productMatch[1]}` as never);
      return;
    }

    const isUrl = data.startsWith("http://") || data.startsWith("https://");
    const buttons: AlertButton[] = [
      {
        text: "Copy",
        onPress: async () => {
          await Clipboard.setStringAsync(data);
          toast("Copied to clipboard");
          setScanned(false);
        },
      },
      ...(isUrl
        ? [
            {
              text: "Open link",
              onPress: () => {
                Linking.openURL(data).catch(() => {
                  toast("Could not open the link");
                });
                setScanned(false);
              },
            },
          ]
        : []),
      { text: "Scan again", onPress: () => setScanned(false), style: "cancel" },
    ];
    Alert.alert("Scanned code", data, buttons, { cancelable: false });
  };

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View
        className="flex-1 items-center justify-center bg-black px-8"
        style={{ paddingTop: insets.top }}
      >
        <Ionicons name="camera-outline" size={44} color="#9CA3AF" />
        <Text className="mt-4 text-center text-base font-semibold text-white">
          Camera access is needed to scan QR codes.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          activeOpacity={0.8}
          className="mt-6 rounded-full bg-primary px-8 py-3"
        >
          <Text className="font-bold text-white">Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const translateY = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize - 2],
  });

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 pt-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTorch((value) => !value)}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              torch ? "bg-primary" : "bg-black/40"
            }`}
            accessibilityRole="button"
            accessibilityLabel="Toggle flashlight"
          >
            <Ionicons
              name={torch ? "flash" : "flash-off"}
              size={20}
              color="white"
            />
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center">
          <Text className="mb-5 text-lg font-bold text-white">
            Align frame with QR code
          </Text>
          <View
            style={{ width: frameSize, height: frameSize }}
            className="overflow-hidden rounded-lg border border-white/20"
          >
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {!scanned ? (
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY }] }]}
              />
            ) : null}
          </View>
        </View>

        <View className="h-20" />
      </View>
    </View>
  );
}

/** The signed-in user's profile QR with download / copy / share actions. */
function MyQrPanel() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const qrRef = useRef<QrSvgRef | null>(null);
  const link = user?.username
    ? `${SITE_URL}/${encodeURIComponent(user.username)}`
    : SITE_URL;

  const copyLink = async () => {
    await Clipboard.setStringAsync(link);
    toast("Link copied");
  };
  const shareLink = () => {
    void Share.share({ message: link });
  };
  const downloadQr = async () => {
    const svg = qrRef.current;
    if (!svg) return;
    const data = await new Promise<string>((resolve) => {
      svg.toDataURL((value) => resolve(value));
    });
    try {
      const directory = FileSystem.cacheDirectory;
      if (!directory) return;
      const fileUri = `${directory}phsarkhmer-qr.png`;
      await FileSystem.writeAsStringAsync(fileUri, data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Expo Go cannot grant gallery-save permissions on Android, so the PNG
      // goes through the system sheet where the user can save it to Photos.
      if (!(await Sharing.isAvailableAsync())) {
        toast("Sharing is not available on this device");
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: "image/png",
        dialogTitle: "Save or share your QR code",
      });
    } catch (error) {
      console.warn("QR save failed", error);
      toast("Could not save the QR code");
    }
  };

  return (
    <View className="flex-1 bg-[#EDEDED]" style={{ paddingTop: insets.top }}>
      <View className="flex-row px-4 pt-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>
      </View>

      {!isAuthenticated ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="person-circle-outline" size={64} color="#9CA3AF" />
          <Text className="mt-4 text-center text-base text-gray-600">
            Sign in to get your profile QR code.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in")}
            activeOpacity={0.8}
            className="mt-6 rounded-full bg-primary px-8 py-3"
          >
            <Text className="font-bold text-white">Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 items-center px-6">
          <View className="mt-4 w-full items-center">
            <View className="z-10 h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white">
              {user?.avatar ? (
                <Image
                  source={{ uri: user.avatar }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person" size={52} color="#BDBDBD" />
              )}
            </View>

            <View
              className="w-full items-center rounded-2xl bg-white px-6 pb-8"
              style={{ marginTop: -48, paddingTop: 60 }}
            >
              <Text className="text-lg font-bold text-gray-900">
                {user?.name || "PhsarKhmer user"}
              </Text>
              {user?.username ? (
                <Text className="mt-1 text-sm text-gray-500">
                  @{user.username}
                </Text>
              ) : null}
              <View className="mt-6">
                <QRCode
                  value={link}
                  size={224}
                  color="#111827"
                  backgroundColor="#FFFFFF"
                  getRef={(ref: QrSvgRef | null) => {
                    qrRef.current = ref;
                  }}
                />
              </View>
            </View>

            <View className="mt-10 w-full flex-row justify-around px-4">
              <ActionButton
                icon="download-outline"
                label="Download"
                onPress={downloadQr}
              />
              <ActionButton
                icon="link-outline"
                label="Copy link"
                onPress={() => void copyLink()}
              />
              <ActionButton
                icon="share-social-outline"
                label="Share"
                onPress={shareLink}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ScanTabKey>("scan");

  return (
    <View className="flex-1 bg-white">
      <StatusBar style={tab === "scan" ? "light" : "dark"} />
      <View className="flex-1">
        {tab === "scan" ? <ScanPanel /> : <MyQrPanel />}
      </View>

      <View
        className="border-t border-gray-100 bg-white"
        style={{ paddingBottom: insets.bottom }}
      >
        <View className="flex-row">
          <TabButton
            label="Scan QR code"
            active={tab === "scan"}
            onPress={() => setTab("scan")}
          />
          <TabButton
            label="My QR code"
            active={tab === "mine"}
            onPress={() => setTab("mine")}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: Colors.primary.DEFAULT,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: "absolute",
    height: 3,
    width: "100%",
    backgroundColor: Colors.primary.DEFAULT,
    shadowColor: Colors.primary.DEFAULT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
});
