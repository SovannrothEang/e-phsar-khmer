import { AuthConfig } from "@/constants/AuthConfig";
import { UserProfile } from "@/contexts/AuthContext";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

export interface SocialAuthResult {
  success: boolean;
  user?: Partial<UserProfile>;
  error?: string;
}

/**
 * Handle Google / Gmail Authentication
 *
 * When configured with Google OAuth Client IDs, this initiates the OAuth flow.
 * In development / demo mode, it authenticates with the configured Google profile.
 */
export async function authenticateWithGoogle(
  mode: "login" | "register" = "login",
): Promise<SocialAuthResult> {
  try {
    const isMock =
      AuthConfig.useMockInDev ||
      AuthConfig.google.webClientId.includes("YOUR_GOOGLE_WEB_CLIENT_ID");

    if (!isMock) {
      // Live Google OAuth Flow via Expo WebBrowser / Redirect
      const redirectUri = Linking.createURL("oauth/google");
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        AuthConfig.google.webClientId,
      )}&response_type=token&scope=${encodeURIComponent(
        AuthConfig.google.scopes.join(" "),
      )}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri,
      );

      if (result.type === "success" && result.url) {
        // Parse access_token from url
        const match = result.url.match(/access_token=([^&]+)/);
        const token = match ? match[1] : null;

        if (token) {
          // Fetch Google User Profile
          const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const googleUser = await res.json();

          return {
            success: true,
            user: {
              name: googleUser.name || "Google User",
              username: (googleUser.email || "user").split("@")[0],
              email: googleUser.email,
              avatar: googleUser.picture || "",
              accountType: "Normal account",
              bio: `Signed in with Google (${googleUser.email})`,
              isVerified: true,
            },
          };
        }
      }
      return { success: false, error: "Authentication cancelled" };
    }

    // Interactive Demo / Mock Flow with Google profile
    const profile = AuthConfig.demoProfiles.google;
    return {
      success: true,
      user: {
        ...profile,
        bio:
          mode === "register"
            ? "New member registered via Google"
            : profile.bio,
      },
    };
  } catch (err: any) {
    console.warn("Google Auth error:", err);
    return {
      success: false,
      error: err?.message || "Google Authentication failed",
    };
  }
}

/**
 * Handle Telegram Authentication
 *
 * Supports opening Telegram App via deep-link (tg://) or web fallback (t.me).
 * Can be connected with Telegram Bot Auth widget.
 */
export async function authenticateWithTelegram(
  mode: "login" | "register" = "login",
): Promise<SocialAuthResult> {
  try {
    const isMock =
      AuthConfig.useMockInDev ||
      AuthConfig.telegram.botUsername === "YOUR_BOT_USERNAME";

    // Attempt to prompt or open Telegram app deep link if desired
    const botUrl = AuthConfig.telegram.botUrl;
    const canOpenTg = await Linking.canOpenURL(
      `tg://resolve?domain=${AuthConfig.telegram.botUsername}`,
    );

    if (!isMock) {
      if (canOpenTg) {
        await Linking.openURL(
          `tg://resolve?domain=${AuthConfig.telegram.botUsername}&start=auth`,
        );
      } else {
        await WebBrowser.openBrowserAsync(botUrl);
      }
    }

    // In demo / development mode, complete with Telegram profile
    const profile = AuthConfig.demoProfiles.telegram;
    return {
      success: true,
      user: {
        ...profile,
        bio:
          mode === "register"
            ? "Verified seller • Registered via Telegram"
            : profile.bio,
      },
    };
  } catch (err: any) {
    console.warn("Telegram Auth error:", err);
    return {
      success: false,
      error: err?.message || "Telegram Authentication failed",
    };
  }
}
