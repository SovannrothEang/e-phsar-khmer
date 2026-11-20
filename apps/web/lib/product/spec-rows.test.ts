import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { foldSpecRows } from "./spec-rows.ts";

describe("foldSpecRows", () => {
  it("returns no rows for no rows", () => {
    assert.deepEqual(foldSpecRows([]), []);
  });

  it("passes a single row through with one value", () => {
    assert.deepEqual(foldSpecRows([{ label: "Engine", value: "2.5L" }]), [
      { label: "Engine", values: ["2.5L"] },
    ]);
  });

  it("folds consecutive rows sharing a label into one row, in order", () => {
    assert.deepEqual(
      foldSpecRows([
        { label: "4G bands", value: "1, 3, 5" },
        { label: "4G bands", value: "38, 40, 41" },
        { label: "5G bands", value: "n1, n3" },
      ]),
      [
        { label: "4G bands", values: ["1, 3, 5", "38, 40, 41"] },
        { label: "5G bands", values: ["n1, n3"] },
      ],
    );
  });

  it("keeps same-label rows separate when they are not consecutive", () => {
    assert.deepEqual(
      foldSpecRows([
        { label: "Battery", value: "5000 mAh" },
        { label: "Storage", value: "256GB" },
        { label: "Battery", value: "removable" },
      ]),
      [
        { label: "Battery", values: ["5000 mAh"] },
        { label: "Storage", values: ["256GB"] },
        { label: "Battery", values: ["removable"] },
      ],
    );
  });
});
