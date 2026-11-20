import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isValidUsername, normalizeManualUsername } from "./username.ts";

test("lowercases, trims and collapses repeated hyphens", () => {
  assert.equal(normalizeManualUsername("  Sok--Dara  "), "sok-dara");
  assert.equal(normalizeManualUsername("--a--"), "a");
  assert.equal(normalizeManualUsername("Sok.Dara"), "sok.dara");
});

test("keeps Khmer letters and marks", () => {
  assert.equal(normalizeManualUsername("សុខ-ដារា"), "សុខ-ដារា");
});

test("composes NFD input to NFC", () => {
  assert.equal(normalizeManualUsername("café"), "café");
});

test("counts code points, not UTF-16 units", () => {
  assert.equal(isValidUsername("a".repeat(50)), true);
  assert.equal(isValidUsername("a".repeat(51)), false);
  assert.equal(isValidUsername("សុខ-ដារា"), true);
});

test("rejects spaces, symbols and short handles", () => {
  assert.equal(isValidUsername("sok dara"), false);
  assert.equal(isValidUsername("sok@dara"), false);
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername(""), false);
});

test("returns an empty string for an all-hyphen handle", () => {
  assert.equal(normalizeManualUsername("---"), "");
  assert.equal(isValidUsername(""), false);
});
