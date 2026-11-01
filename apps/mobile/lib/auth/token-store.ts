import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "phsarkhmer_access_token";
const REFRESH_TOKEN_KEY = "phsarkhmer_refresh_token";
const DEVICE_ID_KEY = "phsarkhmer_device_id";

/**
 * SecureStore has no web implementation. The web preview therefore keeps the
 * session in memory (it is lost on reload), which is acceptable because the
 * real target is Expo Go / a native build.
 */
const useMemoryStore = Platform.OS === "web";
const memory = new Map<string, string>();

async function read(key: string): Promise<string | null> {
  if (useMemoryStore) return memory.get(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  if (useMemoryStore) {
    memory.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function remove(key: string): Promise<void> {
  if (useMemoryStore) {
    memory.delete(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* nothing stored */
  }
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

/**
 * An opaque id that groups this install's login sessions. Math.random is
 * enough — it is not a secret, just a stable device identity for the backend's
 * `user_login_devices` row.
 */
function createDeviceId(): string {
  const random = () =>
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
  return `app-${Date.now().toString(36)}-${random()}`;
}

export const tokenStore = {
  async getSession(): Promise<StoredSession | null> {
    const [accessToken, refreshToken] = await Promise.all([
      read(ACCESS_TOKEN_KEY),
      read(REFRESH_TOKEN_KEY),
    ]);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },

  async setSession(session: StoredSession): Promise<void> {
    await Promise.all([
      write(ACCESS_TOKEN_KEY, session.accessToken),
      write(REFRESH_TOKEN_KEY, session.refreshToken),
    ]);
  },

  async clearSession(): Promise<void> {
    await Promise.all([remove(ACCESS_TOKEN_KEY), remove(REFRESH_TOKEN_KEY)]);
  },

  async getDeviceId(): Promise<string> {
    const existing = await read(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = createDeviceId();
    await write(DEVICE_ID_KEY, id);
    return id;
  },
};
