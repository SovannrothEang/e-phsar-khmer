import assert from "node:assert/strict";
import { test } from "node:test";
import { isJobApplyCandidate } from "./job-apply-candidate.ts";

const base = {
  categorySlug: "jobs",
  listingStatus: "active",
  posterId: "poster",
  viewerId: "viewer",
};

test("an active job viewed by a stranger is a candidate", () => {
  assert.equal(isJobApplyCandidate(base), true);
});

test("signed-out viewers never get the Apply control", () => {
  assert.equal(isJobApplyCandidate({ ...base, viewerId: null }), false);
  assert.equal(isJobApplyCandidate({ ...base, viewerId: undefined }), false);
});

test("the poster cannot apply to their own job", () => {
  assert.equal(isJobApplyCandidate({ ...base, viewerId: "poster" }), false);
});

test("only active jobs in the jobs category qualify", () => {
  assert.equal(isJobApplyCandidate({ ...base, listingStatus: "expired" }), false);
  assert.equal(isJobApplyCandidate({ ...base, categorySlug: "pets" }), false);
  assert.equal(isJobApplyCandidate({ ...base, categorySlug: undefined }), false);
});
