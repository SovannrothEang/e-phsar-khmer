import { and, gt, isNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { userE2eDevices } from '../../db/schema/chat.schema';

/** Hard cap on active devices per user; registering past it evicts the least recently seen. */
export const MAX_ACTIVE_DEVICES = 5;

/** A device unseen this long drops out of the active set (senders stop encrypting to it). */
export const DEVICE_STALE_DAYS = 30;

/** "Active" = not revoked and seen within DEVICE_STALE_DAYS. */
export function activeDeviceCondition(): SQL {
  return and(
    isNull(userE2eDevices.revokedAt),
    gt(
      userE2eDevices.lastSeenAt,
      sql`now() - make_interval(days => ${DEVICE_STALE_DAYS})`,
    ),
  )!;
}

export interface DeviceRef {
  userId: string;
  deviceId: string;
}

/**
 * Compares the device set a sender encrypted to against the server's active
 * set. `missing` = active devices the sender left out (they'd never be able
 * to read the message); `stale` = envelopes for devices that are no longer
 * active (wasted, and a sign the sender's cached device list is old).
 */
export function diffDevices(
  expected: DeviceRef[],
  sentDeviceIds: string[],
): { missing: DeviceRef[]; stale: string[] } {
  const sent = new Set(sentDeviceIds);
  const expectedIds = new Set(expected.map((d) => d.deviceId));
  return {
    missing: expected.filter((d) => !sent.has(d.deviceId)),
    stale: sentDeviceIds.filter((id) => !expectedIds.has(id)),
  };
}
