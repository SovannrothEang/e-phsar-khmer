import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notificationPreviewLimit } from "./preview-limit.ts";

describe("notificationPreviewLimit", () => {
  it("shows 6 rows in the wide-screen popover", () => {
    assert.equal(notificationPreviewLimit(false), 6);
  });

  it("shows 8 rows in the compact-screen drawer", () => {
    assert.equal(notificationPreviewLimit(true), 8);
  });
});
