import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_RETRY_SECONDS,
  formatWait,
  parseOtpFailure,
  parseOtpSent,
} from "./otp-errors.ts";

const err = (code: string, message = "m", extra: object = {}) => ({
  success: false,
  error: { code, message, ...extra },
});

describe("parseOtpFailure", () => {
  it("reads the cooldown wait from the body", () => {
    assert.deepEqual(
      parseOtpFailure(429, err("OTP_COOLDOWN", "wait", { retryAfterSeconds: 42 })),
      { success: false, code: "cooldown", retryAfterSeconds: 42 },
    );
  });

  it("falls back to details, then the header, then the default", () => {
    const viaDetails = parseOtpFailure(
      429,
      err("OTP_COOLDOWN", "w", { details: { retryAfterSeconds: 30 } }),
    );
    assert.equal(viaDetails.retryAfterSeconds, 30);
    assert.equal(
      parseOtpFailure(429, err("OTP_COOLDOWN"), "15").retryAfterSeconds,
      15,
    );
    assert.equal(
      parseOtpFailure(429, err("OTP_COOLDOWN")).retryAfterSeconds,
      DEFAULT_RETRY_SECONDS,
    );
  });

  it("treats a code-less 429 (global throttler) as a cooldown", () => {
    const r = parseOtpFailure(429, err("TOO_MANY_REQUESTS", "ThrottlerException"));
    assert.equal(r.code, "cooldown");
  });

  it("maps the domain codes", () => {
    assert.equal(parseOtpFailure(429, err("OTP_DAILY_CAP")).code, "daily_cap");
    assert.equal(parseOtpFailure(503, err("OTP_SEND_FAILED")).code, "send_failed");
    assert.equal(
      parseOtpFailure(503, err("OTP_PROVIDER_UNSUPPORTED")).code,
      "provider_unsupported",
    );
    assert.equal(
      parseOtpFailure(401, err("OTP_TOO_MANY_ATTEMPTS", "Invalid or expired OTP"))
        .code,
      "too_many_attempts",
    );
  });

  it("maps wrong/expired code and bad credentials", () => {
    assert.equal(
      parseOtpFailure(401, err("UNAUTHORIZED", "Invalid or expired OTP")).code,
      "invalid_code",
    );
    assert.equal(
      parseOtpFailure(401, err("UNAUTHORIZED", "INVALID_CREDENTIALS")).code,
      "invalid_credentials",
    );
  });

  it("survives a missing body", () => {
    assert.equal(parseOtpFailure(500, null).code, "unknown");
    assert.equal(parseOtpFailure(503, null).code, "send_failed");
  });
});

describe("parseOtpSent", () => {
  it("returns the server cooldown", () => {
    assert.deepEqual(
      parseOtpSent({ success: true, data: { otpSent: true, retryAfterSeconds: 60 } }),
      { success: true, retryAfterSeconds: 60 },
    );
  });
  it("defaults when absent (supabase path) and rejects non-success", () => {
    assert.equal(
      parseOtpSent({ success: true, data: { otpSent: true } })?.retryAfterSeconds,
      DEFAULT_RETRY_SECONDS,
    );
    assert.equal(parseOtpSent({ success: false }), null);
    assert.equal(parseOtpSent(null), null);
  });
});

describe("formatWait", () => {
  it("uses seconds below two minutes and rounds minutes up", () => {
    assert.deepEqual(formatWait(54), { unit: "seconds", value: 54 });
    assert.deepEqual(formatWait(119), { unit: "seconds", value: 119 });
    assert.deepEqual(formatWait(120), { unit: "minutes", value: 2 });
    assert.deepEqual(formatWait(3601), { unit: "minutes", value: 61 });
    assert.deepEqual(formatWait(0), { unit: "seconds", value: 1 });
  });
});
