import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlainLeftClick } from "./spec-scroll.ts";

const plain = {
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  button: 0,
};

describe("isPlainLeftClick", () => {
  it("accepts a plain left click", () => {
    assert.equal(isPlainLeftClick(plain), true);
  });

  for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
    it(`rejects a click holding ${key}`, () => {
      assert.equal(isPlainLeftClick({ ...plain, [key]: true }), false);
    });
  }

  it("rejects a middle click", () => {
    assert.equal(isPlainLeftClick({ ...plain, button: 1 }), false);
  });
});
