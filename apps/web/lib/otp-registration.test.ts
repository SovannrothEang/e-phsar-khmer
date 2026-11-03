import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearOtpRegistration,
  clearRegisterDraft,
  readOtpRegistration,
  readRegisterDraft,
  REGISTER_DRAFT_TTL_MS,
  storeOtpRegistration,
  storeRegisterDraft,
} from "./otp-registration.ts";

/** The module only touches `sessionStorage` inside its functions. */
class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

(globalThis as { sessionStorage?: Storage }).sessionStorage =
  new MemoryStorage() as unknown as Storage;

const withNow = <T>(now: number, run: () => T): T => {
  const realNow = Date.now;
  Date.now = () => now;
  try {
    return run();
  } finally {
    Date.now = realNow;
  }
};

describe("OTP handoff", () => {
  it("round-trips the wait and stamps the send time", () => {
    sessionStorage.clear();
    withNow(1_700_000_000_000, () => {
      storeOtpRegistration({
        mode: "register",
        phone: "+85512345678",
        password: "password123",
        firstName: "Sok",
        lastName: "Dara",
        retryAfterSeconds: 300,
      });
    });

    const handoff = readOtpRegistration("+85512345678");
    assert.equal(handoff?.retryAfterSeconds, 300);
    assert.equal(handoff?.sentAt, 1_700_000_000_000);
    assert.equal(handoff?.firstName, "Sok");
  });

  it("discards a handoff for another phone", () => {
    sessionStorage.clear();
    storeOtpRegistration({
      mode: "login",
      phone: "+85512345678",
      password: "password123",
    });

    assert.equal(readOtpRegistration("+85599999999"), null);
    // The mismatched entry is dropped, not left to leak into the next phone.
    assert.equal(readOtpRegistration("+85512345678"), null);
  });

  it("rejects a password that cannot be a real one", () => {
    sessionStorage.clear();
    storeOtpRegistration({
      mode: "login",
      phone: "+85512345678",
      password: "short",
    });

    assert.equal(readOtpRegistration("+85512345678"), null);
  });

  it("clears on demand", () => {
    sessionStorage.clear();
    storeOtpRegistration({
      mode: "login",
      phone: "+85512345678",
      password: "password123",
    });
    clearOtpRegistration();

    assert.equal(readOtpRegistration("+85512345678"), null);
  });
});

describe("register draft", () => {
  const draft = {
    firstName: "Sok",
    lastName: "Dara",
    phoneNumber: "012345678",
    password: "password123",
  };

  it("round-trips the typed fields", () => {
    sessionStorage.clear();
    storeRegisterDraft(draft);

    assert.deepEqual(readRegisterDraft(), draft);
  });

  it("drops a draft older than the TTL", () => {
    sessionStorage.clear();
    const savedAt = 1_700_000_000_000;
    withNow(savedAt, () => storeRegisterDraft(draft));

    assert.equal(
      withNow(savedAt + REGISTER_DRAFT_TTL_MS + 1, () => readRegisterDraft()),
      null,
    );
  });

  it("drops a draft whose clock moved backwards", () => {
    sessionStorage.clear();
    const savedAt = 1_700_000_000_000;
    withNow(savedAt, () => storeRegisterDraft(draft));

    assert.equal(
      withNow(savedAt - 60_000, () => readRegisterDraft()),
      null,
    );
  });

  it("does not store an empty form", () => {
    sessionStorage.clear();
    storeRegisterDraft({
      firstName: "",
      lastName: "",
      phoneNumber: "",
      password: "",
    });

    assert.equal(readRegisterDraft(), null);
  });

  it("clears on a successful handoff", () => {
    sessionStorage.clear();
    storeRegisterDraft(draft);
    clearRegisterDraft();

    assert.equal(readRegisterDraft(), null);
  });

  it("survives corrupt JSON without throwing", () => {
    sessionStorage.clear();
    sessionStorage.setItem("register_draft", "{not json");

    assert.equal(readRegisterDraft(), null);
  });
});
