import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeRouteParam } from "./route-params.ts";

test("a percent-encoded Khmer handle decodes back to the stored username", () => {
  assert.equal(
    decodeRouteParam(
      "%E1%9E%9B%E1%9E%B8%E1%9E%98%E1%9E%8F%E1%9E%B6%E1%9E%9A%E1%9E%B6%E1%9E%9A%E1%9E%B7%E1%9E%91%E1%9F%92%E1%9E%92",
    ),
    "លីមតារារិទ្ធ",
  );
});

test("an already-decoded param passes through unchanged", () => {
  assert.equal(decodeRouteParam("abcabc"), "abcabc");
  assert.equal(decodeRouteParam("លីមតារារិទ្ធ"), "លីមតារារិទ្ធ");
});

test("a malformed escape sequence is left alone instead of throwing", () => {
  assert.equal(decodeRouteParam("100%"), "100%");
  assert.equal(decodeRouteParam("a%zz"), "a%zz");
});
