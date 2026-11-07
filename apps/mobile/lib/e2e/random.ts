import type * as ExpoCrypto from "expo-crypto";

/**
 * `@noble/*` reads `globalThis.crypto.getRandomValues` at call time. Hermes has
 * no WebCrypto global, so install one backed by expo-crypto before any E2E
 * module runs. Expo's `getRandomValues` is synchronous and fills the typed
 * array in place — the same contract as the WebCrypto method noble expects.
 *
 * `expo-crypto` is required on first use rather than imported: its JS entry
 * throws at module scope when the native module is missing (a client that does
 * not match the project's SDK), and this file is reachable from `AuthContext`,
 * which the root layout imports. A chat-only native dependency must not take
 * down every route — only encrypted chat needs the polyfill.
 */
type CryptoGlobal = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

let expoCrypto: typeof ExpoCrypto | null | undefined;

function loadExpoCrypto(): typeof ExpoCrypto | null {
  if (expoCrypto === undefined) {
    try {
      expoCrypto = require("expo-crypto") as typeof ExpoCrypto;
    } catch (error) {
      expoCrypto = null;
      console.warn(
        "[e2e] expo-crypto is unavailable, so encrypted chat cannot start. " +
          "Run the app in an Expo Go client that matches this project's SDK.",
        error,
      );
    }
  }
  return expoCrypto;
}

const globals = globalThis as unknown as { crypto?: CryptoGlobal };

if (typeof globals.crypto?.getRandomValues !== "function") {
  globals.crypto = {
    ...(globals.crypto ?? {}),
    getRandomValues: (array: Uint8Array) => {
      const crypto = loadExpoCrypto();
      if (!crypto) {
        throw new Error(
          "Encrypted chat is unavailable: the expo-crypto native module is missing from this client.",
        );
      }
      return crypto.getRandomValues(array);
    },
  };
}

export {};
