import * as Crypto from "expo-crypto";

/**
 * `@noble/*` reads `globalThis.crypto.getRandomValues` at call time. Hermes has
 * no WebCrypto global, so install one backed by expo-crypto before any E2E
 * module runs. Expo's `getRandomValues` is synchronous and fills the typed
 * array in place — the same contract as the WebCrypto method noble expects.
 */
type CryptoGlobal = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

const globals = globalThis as unknown as { crypto?: CryptoGlobal };

if (typeof globals.crypto?.getRandomValues !== "function") {
  globals.crypto = {
    ...(globals.crypto ?? {}),
    getRandomValues: (array: Uint8Array) => Crypto.getRandomValues(array),
  };
}

export {};
