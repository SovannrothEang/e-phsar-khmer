import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actionForPush, E2E_PUSH } from "./push-events.ts";

const ME = "device-me";
const OTHER = "device-other";

describe("actionForPush", () => {
  it("shows a request from another device for approval", () => {
    assert.equal(
      actionForPush(
        {
          type: E2E_PUSH.historyRequested,
          data: { requestId: "r1", requesterDeviceId: OTHER },
        },
        ME,
      ),
      "refresh-approvals",
    );
  });

  it("ignores this device's own request", () => {
    assert.equal(
      actionForPush(
        {
          type: E2E_PUSH.historyRequested,
          data: { requestId: "r1", requesterDeviceId: ME },
        },
        ME,
      ),
      null,
    );
  });

  it("re-checks this device's request once it is answered", () => {
    for (const status of ["approved", "declined"]) {
      assert.equal(
        actionForPush(
          {
            type: E2E_PUSH.historyResolved,
            data: { requestId: "r1", requesterDeviceId: ME, status },
          },
          ME,
        ),
        "check-approval",
      );
    }
  });

  it("refreshes the approval list when another device's request was answered", () => {
    assert.equal(
      actionForPush(
        {
          type: E2E_PUSH.historyResolved,
          data: {
            requestId: "r1",
            requesterDeviceId: OTHER,
            status: "approved",
          },
        },
        ME,
      ),
      "refresh-approvals",
    );
  });

  it("pulls when another device uploaded, not for this device's own upload", () => {
    assert.equal(
      actionForPush(
        { type: E2E_PUSH.backupUpdated, data: { deviceId: OTHER } },
        ME,
      ),
      "pull-backup",
    );
    assert.equal(
      actionForPush(
        { type: E2E_PUSH.backupUpdated, data: { deviceId: ME } },
        ME,
      ),
      null,
    );
  });

  it("treats a hint with missing data as coming from elsewhere (an extra read is cheap)", () => {
    assert.equal(
      actionForPush({ type: E2E_PUSH.historyRequested }, ME),
      "refresh-approvals",
    );
    assert.equal(
      actionForPush({ type: E2E_PUSH.backupUpdated, data: {} }, ME),
      "pull-backup",
    );
  });

  it("ignores every other notification, such as payments", () => {
    assert.equal(
      actionForPush(
        { type: "payment.succeeded", data: { paymentTransactionId: "p1" } },
        ME,
      ),
      null,
    );
    assert.equal(actionForPush({ type: "follow.created" }, ME), null);
  });
});
