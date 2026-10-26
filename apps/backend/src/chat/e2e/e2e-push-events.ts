/**
 * Realtime hints for the encrypted-history backup, sent to the user's open tabs
 * as `notification` frames (see `ChatPushEvent`). They exist so a tab does not
 * have to poll for "someone asked for my history" or "a new segment landed".
 *
 * A hint carries ids only, never ciphertext, wrapped keys or plaintext, and
 * the receiver always re-reads through the authenticated routes. They are
 * best-effort: a missed hint is recovered by the client's safety poll and its
 * catch-up on every (re)connect.
 */
export const E2E_PUSH = {
  /** Another device asked for the backup key: `{ requestId, requesterDeviceId }`. */
  historyRequested: 'e2e.history_requested',
  /** A request was answered: `{ requestId, requesterDeviceId, status }`. */
  historyResolved: 'e2e.history_resolved',
  /** A device uploaded a segment: `{ deviceId }`. */
  backupUpdated: 'e2e.backup_updated',
} as const;

export type E2ePushType = (typeof E2E_PUSH)[keyof typeof E2E_PUSH];
