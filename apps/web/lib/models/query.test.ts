import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdminModelsQuery } from "./query.ts";

describe("buildAdminModelsQuery", () => {
  it("serializes every filter in a stable order", () => {
    assert.equal(
      buildAdminModelsQuery({
        q: "iphone",
        brandId: "b1",
        categoryId: "c1",
        subcategoryId: "s1",
        page: 2,
        pageSize: 20,
      }),
      "q=iphone&brandId=b1&categoryId=c1&subcategoryId=s1&page=2&pageSize=20",
    );
  });

  it("omits empty and whitespace-only values", () => {
    assert.equal(buildAdminModelsQuery({ q: "   " }), "");
    assert.equal(buildAdminModelsQuery({}), "");
  });

  it("trims q", () => {
    assert.equal(buildAdminModelsQuery({ q: "  iphone " }), "q=iphone");
  });
});
