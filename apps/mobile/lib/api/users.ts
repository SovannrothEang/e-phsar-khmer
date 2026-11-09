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

/** One row of the public user search (`GET /users/search`). */
export interface UserSearchItem {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  verifiedAccount: boolean;
}

export interface UserSearchPage {
  items: UserSearchItem[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

/**
 * Anonymous public user search by handle or name. The backend caps `q` at 100
 * chars and `pageSize` at 50; the caller only sends the three declared keys
 * because the global pipe rejects unknown query params.
 */
export async function searchUsers(
  q: string,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {},
): Promise<UserSearchPage> {
  const search = new URLSearchParams({
    q,
    page: String(page),
    pageSize: String(pageSize),
  });
  const { data, meta } = await apiFetch<UserSearchItem[]>(
    `/users/search?${search.toString()}`,
    { auth: false },
  );
  return {
    items: data ?? [],
    total: (meta?.total as number | undefined) ?? 0,
    hasMore: Boolean(meta?.hasMore),
    page: (meta?.page as number | undefined) ?? page,
    pageSize: (meta?.pageSize as number | undefined) ?? pageSize,
  };
}
