/**
 * Realtime hints from the backend about the encrypted-history backup (see
 * `apps/backend/src/chat/e2e/e2e-push-events.ts`). They carry ids only and are
 * best-effort: this module only decides *which* ordinary, authenticated read
 * to run sooner. A missed hint is covered by the safety poll and by the
 * catch-up on every socket (re)connect.
 */
export const E2E_PUSH = {
  historyRequested: "e2e.history_requested",
  historyResolved: "e2e.history_resolved",
  backupUpdated: "e2e.backup_updated",
} as const;

export type E2ePushAction =
  /** Re-read the pending "another device wants my history" list. */
  | "refresh-approvals"
  /** Re-check this device's own request (approved, declined, expired). */
  | "check-approval"
  /** Run the backup sync (upload + pull) now. */
  | "pull-backup";

export interface PushNotification {
  type: string;
  data?: Record<string, unknown>;
}

/**
 * `ownDeviceId` is this browser's device. An event caused by this device itself
 * never needs a re-read; a hint with missing or odd data is treated as coming
 * from elsewhere, because an extra read is cheap and a missed one is not.
 */
export function actionForPush(
  notification: PushNotification,
  ownDeviceId: string,
): E2ePushAction | null {
  const data = notification.data;
  switch (notification.type) {
    case E2E_PUSH.historyRequested:
      return data?.requesterDeviceId === ownDeviceId
        ? null
        : "refresh-approvals";
    case E2E_PUSH.historyResolved:
      // My own request was answered, or another device's was (so the list I
      // show for approval may no longer be current).
      return data?.requesterDeviceId === ownDeviceId
        ? "check-approval"
        : "refresh-approvals";
    case E2E_PUSH.backupUpdated:
      return data?.deviceId === ownDeviceId ? null : "pull-backup";
    default:
      return null;
  }
}
