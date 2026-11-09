import { ApiError, setSessionExpiredHandler } from "@/lib/api/client";
import {
  fetchMe,
  loginWithPassword,
  logoutSession,
  registerWithPhone,
  requestLoginOtp,
  requestOtp,
  verifyPhoneOtp,
  type AuthResult,
  type BackendUser,
} from "@/lib/api/auth";
import { tokenStore } from "@/lib/auth/token-store";
import { toUserProfile } from "@/lib/auth/user-adapter";
import { looksLikePhone, normalizePhone } from "@/lib/phone";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface UserProfile {
  name: string;
  /** The account's own name fields; the resume builder prefills with them. */
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  phone: string;
  avatar: string;
  coverPhoto?: string;
  gender?: string;
  telegram?: string;
  accountType?: string;
  location: string;
  bio: string;
  joinDate: string;
  isVerified: boolean;
  connectedAccounts?: {
    google?: string;
    telegram?: string;
    facebook?: string;
    apple?: string;
  };
  stats: {
    activeAds: number;
    favorites: number;
    views: number;
    rating: number;
  };
}

const EMPTY_USER: UserProfile = {
  name: "",
  username: undefined,
  email: "",
  phone: "",
  avatar: "",
  coverPhoto: "",
  gender: undefined,
  telegram: "",
  accountType: "Normal account",
  location: "",
  bio: "",
  joinDate: "",
  isVerified: false,
  connectedAccounts: {},
  stats: {
    activeAds: 0,
    favorites: 0,
    views: 0,
    rating: 0,
  },
};

/**
 * What the OTP screen needs. Held in memory only — never persisted.
 * A login carries the password captured on the sign-in screen; a registration
 * collects its password and names on the OTP screen itself.
 */
export type PendingVerification =
  | { mode: "login"; phone: string; password: string }
  | {
      mode: "register";
      phone: string;
      /** Collected on the "Create your account" step, applied at verification. */
      profile?: { firstName: string; lastName: string; password: string };
    };

/** Supplied by the OTP screen when finishing a phone-only registration. */
export interface OtpRegistrationDetails {
  password: string;
  firstName?: string;
  lastName?: string;
}

/** The contact channels a suspension notice offers, all optional. */
export interface SuspensionSupport {
  email?: string;
  telegram?: string;
  phone?: string;
}

export type AuthOutcome =
  | { kind: "authenticated" }
  | { kind: "otp"; phone: string }
  // A suspension is not a retryable error: it gets its own outcome so the
  // screen can explain the status and the appeal channels instead of printing
  // a generic failure into the password field.
  | {
      kind: "suspended";
      reason: string | null;
      support: SuspensionSupport;
    }
  | { kind: "error"; message: string };

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile;
  /** The signed-in account's id (null when anonymous) — chat/E2E keys need it. */
  userId: string | null;
  pendingVerification: PendingVerification | null;
  /** Carries the create-account fields from their screen to the OTP step. */
  setRegistrationProfile: (profile: {
    firstName: string;
    lastName: string;
    password: string;
  }) => void;
  /** Phone-shaped identifiers take the OTP path; everything else is password login. */
  signIn: (identifier: string, password: string) => Promise<AuthOutcome>;
  /**
   * Password-only sign-in that never diverts to an OTP — used right after a
   * password reset, where the phone was proved moments earlier.
   */
  signInWithPassword: (
    identifier: string,
    password: string,
  ) => Promise<AuthOutcome>;
  signUp: (input: { phone: string }) => Promise<AuthOutcome>;
  /** `details` is required when the pending verification is a registration. */
  verifyOtp: (
    token: string,
    details?: OtpRegistrationDetails,
  ) => Promise<AuthOutcome>;
  resendOtp: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  /** Local-only patch for screens that have not persisted yet. */
  updateUser: (updates: Partial<UserProfile>) => void;
  /** Re-reads `/auth/me` after a profile/phone change. */
  refreshUser: () => Promise<void>;
  /** True when a session exists; screens use it before opening user-only actions. */
  requireAuth: () => boolean;
}

/**
 * Chat crypto is loaded on demand: `lib/e2e/device` pulls `@noble/curves`,
 * which probes `crypto.getRandomValues` at import time and throws when the
 * client has no expo-crypto native module. Only chat needs it, so the root
 * layout must never fail because of it.
 */
function e2eDevice(): typeof import("@/lib/e2e/device") | null {
  try {
    return require("@/lib/e2e/device") as typeof import("@/lib/e2e/device");
  } catch (error) {
    console.warn(
      "[e2e] encrypted chat is unavailable in this client; skipping device setup.",
      error,
    );
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Network error. Check your connection and try again.";
  }
  if (error.status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (error.code === "PHONE_BANNED" || error.message === "PHONE_BANNED") {
    return "This phone number has been banned.";
  }
  if (error.message === "INVALID_CREDENTIALS") {
    return "Invalid phone number or password.";
  }
  if (error.message === "INVALID_OTP" || error.message === "OTP_EXPIRED") {
    return "Invalid or expired code.";
  }
  if (error.status === 401) {
    return "Invalid credentials.";
  }
  return error.message || "Something went wrong. Please try again.";
}

/** Maps the backend's `403 ACCOUNT_SUSPENDED` onto its own outcome. */
function authFailure(error: unknown): AuthOutcome {
  if (error instanceof ApiError && error.code === "ACCOUNT_SUSPENDED") {
    const details = (error.details ?? {}) as {
      reason?: string | null;
      support?: SuspensionSupport;
    };
    return {
      kind: "suspended",
      reason: details.reason ?? error.message ?? null,
      support: details.support ?? {},
    };
  }
  return { kind: "error", message: authErrorMessage(error) };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);

  const clearSessionState = useCallback(() => {
    setIsAuthenticated(false);
    setUser(EMPTY_USER);
    setUserId(null);
    setPendingVerification(null);
  }, []);

  const completeAuth = useCallback(async (result: AuthResult) => {
    await tokenStore.setSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    setUser(toUserProfile(result.user as BackendUser));
    setUserId(result.user.id);
    setIsAuthenticated(true);
    setPendingVerification(null);
    // Register this phone as an E2E chat device in the background; the chat
    // screen retries on demand if this pass fails.
    e2eDevice()?.bootstrapE2eAfterAuth(result.user.id);
  }, []);

  // Restore the session once at boot; a failed refresh has already cleared the
  // tokens, so only a hard 401 clears state here.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await tokenStore.getSession();
        if (!session) return;
        const me = await fetchMe();
        if (cancelled) return;
        setUser(toUserProfile(me));
        setUserId(me.id);
        setIsAuthenticated(true);
        e2eDevice()?.bootstrapE2eAfterAuth(me.id);
      } catch {
        /* Not signed in (or offline) — the visitor shell is the safe default. */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSessionState();
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSessionState]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<AuthOutcome> => {
      const value = identifier.trim();
      if (!value)
        return {
          kind: "error",
          message: "Enter your phone number or username.",
        };

      if (looksLikePhone(value)) {
        const phone = normalizePhone(value);
        if (!phone) {
          return { kind: "error", message: "Enter a valid phone number." };
        }
        if (password.length < 8) {
          return {
            kind: "error",
            message: "Password must be at least 8 characters.",
          };
        }
        try {
          await requestLoginOtp(phone, password);
          setPendingVerification({ mode: "login", phone, password });
          return { kind: "otp", phone };
        } catch (error) {
          return { kind: "error", message: authErrorMessage(error) };
        }
      }

      if (password.length < 6) {
        return {
          kind: "error",
          message: "Password must be at least 6 characters.",
        };
      }
      try {
        const result = await loginWithPassword(value, password);
        await completeAuth(result);
        return { kind: "authenticated" };
      } catch (error) {
        return authFailure(error);
      }
    },
    [completeAuth],
  );

  const setRegistrationProfile = useCallback(
    (profile: { firstName: string; lastName: string; password: string }) => {
      setPendingVerification((prev) =>
        prev?.mode === "register" ? { ...prev, profile } : prev,
      );
    },
    [],
  );

  const signInWithPassword = useCallback(
    async (identifier: string, password: string): Promise<AuthOutcome> => {
      const value = identifier.trim();
      if (!value) return { kind: "error", message: "Enter your account." };
      try {
        const result = await loginWithPassword(value, password);
        await completeAuth(result);
        return { kind: "authenticated" };
      } catch (error) {
        return authFailure(error);
      }
    },
    [completeAuth],
  );

  const signUp = useCallback(
    async (input: { phone: string }): Promise<AuthOutcome> => {
      const phone = normalizePhone(input.phone);
      if (!phone)
        return { kind: "error", message: "Enter a valid phone number." };

      try {
        await registerWithPhone(phone);
        setPendingVerification({ mode: "register", phone });
        return { kind: "otp", phone };
      } catch (error) {
        return { kind: "error", message: authErrorMessage(error) };
      }
    },
    [],
  );

  const verifyOtp = useCallback(
    async (
      token: string,
      details?: OtpRegistrationDetails,
    ): Promise<AuthOutcome> => {
      if (!pendingVerification) {
        return {
          kind: "error",
          message: "Your verification expired. Please start again.",
        };
      }
      const code = token.trim();
      if (code.length < 4 || code.length > 8) {
        return { kind: "error", message: "Enter the code from the SMS." };
      }

      // A registration collects its password and names on the OTP screen; a
      // login already carries the password captured at sign-in.
      let password: string;
      let firstName: string | undefined;
      let lastName: string | undefined;
      if (pendingVerification.mode === "register") {
        if (!details || details.password.length < 8) {
          return {
            kind: "error",
            message: "Password must be at least 8 characters.",
          };
        }
        password = details.password;
        firstName = details.firstName?.trim() || undefined;
        lastName = details.lastName?.trim() || undefined;
      } else {
        password = pendingVerification.password;
      }

      try {
        const result = await verifyPhoneOtp({
          phone: pendingVerification.phone,
          token: code,
          password,
          mode: pendingVerification.mode,
          firstName,
          lastName,
        });
        await completeAuth(result);
        return { kind: "authenticated" };
      } catch (error) {
        return { kind: "error", message: authErrorMessage(error) };
      }
    },
    [completeAuth, pendingVerification],
  );

  const resendOtp = useCallback(async () => {
    if (!pendingVerification) {
      return {
        success: false,
        error: "Your verification expired. Please start again.",
      };
    }
    try {
      await requestOtp(pendingVerification.phone);
      return { success: true };
    } catch (error) {
      return { success: false, error: authErrorMessage(error) };
    }
  }, [pendingVerification]);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } catch {
      /* the local session is cleared regardless */
    }
    await tokenStore.clearSession();
    e2eDevice()?.clearE2eEngines();
    clearSessionState();
  }, [clearSessionState]);

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const me = await fetchMe();
      setUser(toUserProfile(me));
    } catch {
      /* keep the last good profile */
    }
  }, [isAuthenticated]);

  const requireAuth = useCallback(() => isAuthenticated, [isAuthenticated]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        userId,
        pendingVerification,
        setRegistrationProfile,
        signIn,
        signInWithPassword,
        signUp,
        verifyOtp,
        resendOtp,
        logout,
        updateUser,
        refreshUser,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
