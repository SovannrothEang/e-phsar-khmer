/**
 * Authentication Configuration for PhsarKhmer
 *
 * Configure your Google OAuth credentials and Telegram Bot credentials here.
 * When real credentials are provided and `useMockInDev` is false, the app will
 * initiate live OAuth/Deep linking flows.
 */

export const AuthConfig = {
  // Toggle mock authentication for development/testing without API keys
  useMockInDev: true,

  // Google OAuth Configuration
  // Obtain these from Google Cloud Console -> APIs & Services -> Credentials
  google: {
    // Web Client ID (Required for Google Identity Services / Expo AuthSession)
    webClientId: "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com",
    // Android Client ID (Configured with SHA-1 fingerprint & package com.phsarkhmer.app)
    androidClientId: "YOUR_GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com",
    // iOS Client ID (Configured with iOS bundle identifier)
    iosClientId: "YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com",
    // Scopes to request
    scopes: ["profile", "email"],
  },

  // Telegram Login Configuration
  // Create a bot via @BotFather on Telegram to get your bot username
  telegram: {
    // Your Telegram Bot Username without '@'
    botUsername: "phsarkhmer_kh_bot",
    // Direct bot link for deep-linking (e.g., tg://resolve?domain=... or https://t.me/...)
    botUrl: "https://t.me/phsarkhmer_kh_bot",
    // Optional web auth widget URL or domain configured in @BotFather via /setdomain
    domain: "phsarkhmer.com",
  },

  // Demo / Sample profiles used when authenticating in mock mode
  demoProfiles: {
    google: {
      name: "Ban Sreypov",
      username: "bansreypov",
      email: "bansreypov@gmail.com",
      phone: "015 455 758",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
      accountType: "Normal account",
      bio: "Verified buyer & seller • Signed in with Google",
      isVerified: true,
    },
    telegram: {
      name: "Sokha Chan (Telegram)",
      username: "sokha_kh",
      email: "sokha.telegram@phsarkhmer.com",
      phone: "012 889 900",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      accountType: "Normal account",
      bio: "Verified seller • Connected via Telegram @sokha_kh",
      isVerified: true,
    },
  },
};
