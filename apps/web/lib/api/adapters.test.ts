import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOnline, ONLINE_WINDOW_MS } from "./adapters.ts";

const NOW = Date.parse("2026-11-10T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

describe("isOnline", () => {
  it("uses the two-minute presence window", () => {
    assert.equal(ONLINE_WINDOW_MS, 120_000);
  });

  it("is online just inside the window", () => {
    assert.equal(isOnline(at(119_000), NOW), true);
  });

  it("is offline at and after the boundary", () => {
    assert.equal(isOnline(at(120_000), NOW), false);
    assert.equal(isOnline(at(121_000), NOW), false);
  });

  it("is offline without a valid timestamp", () => {
    assert.equal(isOnline(null, NOW), false);
    assert.equal(isOnline("not-a-date", NOW), false);
  });
});
