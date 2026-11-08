import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isJwtExpired } from "./jwt-exp.ts";

const b64url = (value: object) =>
  Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const jwt = (claims: object) => `header.${b64url(claims)}.signature`;

test("an absent token is expired", () => {
  assert.equal(isJwtExpired(null), true);
});

test("a token with no payload segment is expired", () => {
  assert.equal(isJwtExpired("not-a-jwt"), true);
});

test("a token that is not base64 JSON is expired", () => {
  assert.equal(isJwtExpired("a.%%%.b"), true);
});

test("a payload without a numeric exp is expired", () => {
  assert.equal(isJwtExpired(jwt({ sub: "u1" })), true);
  assert.equal(isJwtExpired(jwt({ exp: "1700000000" })), true);
});

test("a past exp is expired, a future exp is not", () => {
  const now = 1_700_000_000_000;
  assert.equal(isJwtExpired(jwt({ exp: 1_699_999_999 }), now), true);
  assert.equal(isJwtExpired(jwt({ exp: 1_700_000_001 }), now), false);
});

test("exp exactly now counts as expired", () => {
  const now = 1_700_000_000_000;
  assert.equal(isJwtExpired(jwt({ exp: 1_700_000_000 }), now), true);
});

test("base64url padding and swapped characters decode", () => {
  // A payload long enough to produce both `+`/`/` and padding in standard b64.
  const claims = { exp: 1_900_000_000, s: "ÿþýü?>>~~~" };
  const token = jwt(claims);
  assert.equal(isJwtExpired(token, 1_700_000_000_000), false);
});
