import { strict as assert } from "node:assert";
import { test } from "node:test";
import { listingPublicUrl, publicSiteOrigin } from "./site.ts";

test("an explicit NEXT_PUBLIC_SITE_URL wins and loses its trailing slash", () => {
  assert.equal(
    publicSiteOrigin("http://admin.localhost:3001", "https://phsarkhmer.com/"),
    "https://phsarkhmer.com",
  );
});

test("the admin prefix is stripped from the current origin", () => {
  for (const host of [
    "admin.localhost:3001",
    "backoffice.phsarkhmer.com",
    "phsar-admin.phsarkhmer.com",
    "phsar-backoffice.phsarkhmer.com",
  ]) {
    const origin = `http://${host}`;
    const expected = `http://${host.replace(
      /^(phsar-backoffice|phsar-admin|backoffice|admin)\./,
      "",
    )}`;
    assert.equal(publicSiteOrigin(origin, undefined), expected, host);
  }
});

test("a non-admin origin is returned untouched", () => {
  // Single-host dev: the dashboard and the marketplace share an origin, so
  // there is nothing to strip and nothing to change.
  assert.equal(
    publicSiteOrigin("https://phsarkhmer.com", undefined),
    "https://phsarkhmer.com",
  );
  assert.equal(
    publicSiteOrigin("http://localhost:3001", undefined),
    "http://localhost:3001",
  );
});

test("an unparseable origin falls back to the canonical site", () => {
  const origin = publicSiteOrigin("not a url", undefined);
  assert.match(origin, /^https?:\/\//);
});

test("the listing URL carries the locale, the slug and the id", () => {
  assert.equal(
    listingPublicUrl({
      origin: "http://localhost:3001",
      locale: "en",
      title: "Xiaomi 14",
      id: "5e691649-807c-4c71-a1e9-44c8e44b7f76",
    }),
    "http://localhost:3001/en/xiaomi-14-adid-5e691649-807c-4c71-a1e9-44c8e44b7f76",
  );
});

test("a missing or empty title still resolves with the id", () => {
  const id = "5e691649-807c-4c71-a1e9-44c8e44b7f76";
  assert.equal(
    listingPublicUrl({
      origin: "http://localhost:3001",
      locale: "km",
      title: null,
      id,
    }),
    `http://localhost:3001/km/listing-adid-${id}`,
  );
  assert.equal(
    listingPublicUrl({
      origin: "http://localhost:3001",
      locale: "km",
      title: "  ",
      id,
    }),
    `http://localhost:3001/km/listing-adid-${id}`,
  );
});
