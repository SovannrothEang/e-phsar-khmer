import { apiFetch } from "@/lib/api/client";

export interface PublicProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  isVerified: boolean;
  verifiedAccount: boolean;
  createdAt: string;
  followers: number;
  following: number;
}

/** Anonymous public profile read (`GET /users/by-username/:username`). */
export async function fetchPublicProfile(
  username: string,
): Promise<PublicProfile> {
  const { data } = await apiFetch<PublicProfile>(
    `/users/by-username/${encodeURIComponent(username)}`,
    { auth: false },
  );
  return data;
}

export async function fetchFollowStatus(
  userId: string,
): Promise<{ following: boolean }> {
  const { data } = await apiFetch<{ following: boolean }>(
    `/users/${encodeURIComponent(userId)}/follow`,
  );
  return data;
}

export async function followUser(userId: string): Promise<{ following: true }> {
  const { data } = await apiFetch<{ following: true }>(
    `/users/${encodeURIComponent(userId)}/follow`,
    { method: "POST" },
  );
  return data;
}

export async function unfollowUser(
  userId: string,
): Promise<{ following: false }> {
  const { data } = await apiFetch<{ following: false }>(
    `/users/${encodeURIComponent(userId)}/follow`,
    { method: "DELETE" },
  );
  return data;
}
