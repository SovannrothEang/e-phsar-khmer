import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_SOURCE_BYTES,
  MAX_STORED_LONG_SIDE,
  shouldReencode,
  targetDimensions,
} from "./upload.ts";

describe("targetDimensions", () => {
  it("caps the long side and keeps the aspect ratio", () => {
    assert.deepEqual(targetDimensions(4032, 3024), {
      width: MAX_STORED_LONG_SIDE,
      height: 1920,
    });
    assert.deepEqual(targetDimensions(3024, 4032), {
      width: 1920,
      height: MAX_STORED_LONG_SIDE,
    });
  });

  it("never upscales a small image", () => {
    assert.deepEqual(targetDimensions(400, 300), { width: 400, height: 300 });
    assert.deepEqual(targetDimensions(1, 1), { width: 1, height: 1 });
  });

  it("returns 0×0 for a dimension the browser could not read", () => {
    assert.deepEqual(targetDimensions(0, 300), { width: 0, height: 0 });
    assert.deepEqual(targetDimensions(Number.NaN, 300), {
      width: 0,
      height: 0,
    });
  });
});

describe("shouldReencode", () => {
  const small = { width: 1200, height: 800 };
  const large = { width: 4032, height: 3024 };

  it("re-encodes a big JPEG to WebP", () => {
    assert.equal(
      shouldReencode({ ...large, mime: "image/jpeg", canEncodeWebp: true }),
      true,
    );
  });

  it("leaves a small WebP alone — a second lossy pass only loses quality", () => {
    assert.equal(
      shouldReencode({ ...small, mime: "image/webp", canEncodeWebp: true }),
      false,
    );
  });

  it("still resizes an oversized WebP", () => {
    assert.equal(
      shouldReencode({ ...large, mime: "image/webp", canEncodeWebp: true }),
      true,
    );
  });

  it("never re-encodes when the browser cannot produce WebP", () => {
    assert.equal(
      shouldReencode({ ...large, mime: "image/png", canEncodeWebp: false }),
      false,
    );
  });
});

describe("MAX_SOURCE_BYTES", () => {
  it("is 10 MB — the picker rejects above it", () => {
    assert.equal(MAX_SOURCE_BYTES, 10 * 1024 * 1024);
  });
});
