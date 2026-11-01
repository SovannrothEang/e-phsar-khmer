import * as Device from "expo-device";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Cached in-memory so subsequent screen transitions don't refetch
let cachedIpAddress: string | null = null;
let cachedDeviceLabel: string | null = null;

export interface DeviceInfo {
  version: string;
  deviceLabel: string;
  ipAddress: string;
  isLoading: boolean;
}

export const useDeviceInfo = (customVersion?: string): DeviceInfo => {
  const appVersion = customVersion || "2026.10.08";

  // Determine Device Model & OS dynamically across iOS, Android, and Web
  const getDeviceLabel = (): string => {
    if (cachedDeviceLabel) return cachedDeviceLabel;

    try {
      let model = Device.modelName;

      if (!model) {
        if (Platform.OS === "android") {
          const constants = Platform.constants as any;
          const manufacturer =
            Device.manufacturer || constants?.Manufacturer || "";
          const androidModel = constants?.Model || Device.deviceName || "";
          model = [manufacturer, androidModel].filter(Boolean).join(" ").trim();
          if (!model) model = "Android Device";
        } else if (Platform.OS === "ios") {
          model = Device.deviceName || "iPhone";
        } else {
          model = "Web Browser";
        }
      }

      let os = Device.osVersion;
      if (!os) {
        if (Platform.OS === "android") {
          const constants = Platform.constants as any;
          os = String(constants?.Release || Platform.Version || "");
        } else if (Platform.OS === "ios") {
          os = String(Platform.Version || "");
        }
      }

      const label = os ? `${model}: ${os}` : model;
      cachedDeviceLabel = label;
      return label;
    } catch {
      return Platform.OS === "ios"
        ? "iPhone XS Max: 18.7.10"
        : "Android Device: 14";
    }
  };

  const [deviceLabel, setDeviceLabel] = useState<string>(getDeviceLabel());
  const [ipAddress, setIpAddress] = useState<string>(
    cachedIpAddress || "175.100.52.253",
  );
  const [isLoading, setIsLoading] = useState<boolean>(!cachedIpAddress);

  useEffect(() => {
    // If device label was generic, re-check once Device properties finish resolving
    setDeviceLabel((prev) => {
      const currentLabel = getDeviceLabel();
      return currentLabel === prev ? prev : currentLabel;
    });

    if (cachedIpAddress) {
      setIpAddress(cachedIpAddress);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const fetchPublicIp = async () => {
      // 1. Try ipify API
      try {
        const res = await fetch("https://api.ipify.org?format=json", {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ip && isMounted) {
            cachedIpAddress = data.ip;
            setIpAddress(data.ip);
            return;
          }
        }
      } catch {
        // Fallback to secondary provider
      }

      // 2. Try ipinfo.io fallback
      try {
        const res2 = await fetch("https://ipinfo.io/json", {
          signal: controller.signal,
        });
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2?.ip && isMounted) {
            cachedIpAddress = data2.ip;
            setIpAddress(data2.ip);
            return;
          }
        }
      } catch {
        // Fallback to tertiary provider
      }

      // 3. Try icanhazip fallback
      try {
        const res3 = await fetch("https://icanhazip.com", {
          signal: controller.signal,
        });
        if (res3.ok) {
          const textIp = (await res3.text()).trim();
          if (textIp && isMounted) {
            cachedIpAddress = textIp;
            setIpAddress(textIp);
            return;
          }
        }
      } catch {
        // Keep initial fallback IP if completely offline
      } finally {
        if (isMounted) setIsLoading(false);
        clearTimeout(timeoutId);
      }
    };

    fetchPublicIp();

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  return {
    version: appVersion,
    deviceLabel,
    ipAddress,
    isLoading,
  };
};
