import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminNotificationHref } from "./admin-links.ts";

describe("adminNotificationHref", () => {
  it("sends a user report to the user review queue", () => {
    assert.equal(
      adminNotificationHref({
        type: "report.created",
        data: { targetType: "user", targetId: "u1" },
      }),
      "/wanderer/dashboard/report/users",
    );
  });

  it("sends a listing report to the post review queue", () => {
    assert.equal(
      adminNotificationHref({
        type: "report.created",
        data: { targetType: "listing", targetId: "l1" },
      }),
      "/wanderer/dashboard/report/posts",
    );
  });

  it("sends a threshold alert to the Users page", () => {
    assert.equal(
      adminNotificationHref({
        type: "report.threshold",
        data: { targetUserId: "u1", approvedReports: 3 },
      }),
      "/wanderer/dashboard/users",
    );
  });

  it("sends a post-publication edit to the Listings page", () => {
    assert.equal(
      adminNotificationHref({
        type: "listing.edited",
        data: { listingId: "l1" },
      }),
      "/wanderer/dashboard/listings",
    );
  });

  it("has no destination for an unknown type or a report without a target", () => {
    assert.equal(
      adminNotificationHref({ type: "security.new_login", data: {} }),
      null,
    );
    assert.equal(
      adminNotificationHref({ type: "report.created", data: {} }),
      null,
    );
  });
});
