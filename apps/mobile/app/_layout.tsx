import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ReactionsProvider } from "@/contexts/ReactionsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { API_URL } from "@/lib/api/config";
import { probeApi } from "@/lib/api/probe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { cssInterop } from "nativewind";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

cssInterop(LinearGradient, { className: "style" });
cssInterop(BlurView, { className: "style" });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    if (!__DEV__) return;
    probeApi().then((ok) => {
      if (ok) {
        console.log("[api] reachable:", API_URL);
      } else {
        console.warn(
          "[api] unreachable — set EXPO_PUBLIC_API_URL to this machine's LAN IP",
          API_URL,
        );
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ReactionsProvider>
              <NotificationProvider>
                <QueryClientProvider client={queryClient}>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(categories)" />
                    <Stack.Screen name="account" />
                    <Stack.Screen name="filters" />
                    <Stack.Screen
                      name="scan"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                        gestureEnabled: true,
                      }}
                    />
                    <Stack.Screen
                      name="search"
                      options={{
                        animation: "fade_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="search-users"
                      options={{
                        animation: "fade_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="search-posts"
                      options={{
                        animation: "fade_from_bottom",
                      }}
                    />
                  </Stack>
                </QueryClientProvider>
              </NotificationProvider>
            </ReactionsProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
