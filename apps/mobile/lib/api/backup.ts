import { apiFetch } from "@/lib/api/client";

export interface BackupKdfParams {
  alg: "argon2id";
  t: number;
  m: number;
  p: number;
}

export interface BackupStatus {
  exists: boolean;
  keyCheck: string | null;
  hasPasscode: boolean;
  passcodeSalt: string | null;
  passcodeParams: BackupKdfParams | null;
  lockedUntil: string | null;
}

export interface BackupSegmentPage {
  items: { id: string; ciphertext: string; messageCount: number }[];
  nextCursor: string | null;
  latestCursor: string | null;
}

/** Everything here is ciphertext or a passcode-derived key — never the passcode. */
export async function fetchBackupStatus(): Promise<BackupStatus> {
  const { data } = await apiFetch<BackupStatus>("/chats/e2e/backup");
  return data;
}

/** Proves the passcode; returns the backup key wrapped under the passcode key. */
export async function unlockBackup(authKey: string): Promise<{
  wrappedKey: string;
}> {
  const { data } = await apiFetch<{ wrappedKey: string }>(
    "/chats/e2e/backup/unlock",
    { method: "POST", body: { authKey } },
  );
  return data;
}

export async function fetchBackupSegments(
  deviceId: string,
  cursor?: string,
): Promise<BackupSegmentPage> {
  const params = new URLSearchParams({ deviceId });
  if (cursor) params.set("cursor", cursor);
  const { data } = await apiFetch<BackupSegmentPage>(
    `/chats/e2e/backup/segments?${params.toString()}`,
  );
  return data;
}
