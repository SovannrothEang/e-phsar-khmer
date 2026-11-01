import { apiFetch } from "@/lib/api/client";
import type { BackendUser } from "@/lib/api/auth";
import type { ListingDetail } from "@/lib/api/listings";

export interface MyDevice {
  id: string;
  name: string;
  clientType: "browser" | "app" | null;
  clientVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export interface MyPhone {
  id: string;
  phone: string;
  isPrimary: boolean;
}

export interface MyAdsPage {
  items: ListingDetail[];
  total: number;
  hasMore: boolean;
}

export type MyAdsTab = "active" | "expired" | "hidden" | "all";

export interface ProfilePatch {
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female" | null;
  dateOfBirth?: string | null;
  company?: string | null;
  email?: string | null;
  address?: string | null;
  discoverableByGender?: boolean;
  discoverableByDateOfBirth?: boolean;
  discoverableByPhone?: boolean;
  discoverableByEmail?: boolean;
  discoverableByLocation?: boolean;
}

export async function fetchMyProfile(): Promise<BackendUser> {
  const { data } = await apiFetch<BackendUser>("/users/me");
  return data;
}

export async function updateMyProfile(
  patch: ProfilePatch,
): Promise<BackendUser> {
  const { data } = await apiFetch<BackendUser>("/users/me", {
    method: "PATCH",
    body: patch,
  });
  return data;
}

export async function changeMyUsername(username: string): Promise<void> {
  await apiFetch<BackendUser>("/users/me/username", {
    method: "PATCH",
    body: { username },
  });
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<unknown>("/users/me/password", {
    method: "PATCH",
    body: { currentPassword, newPassword },
  });
}

/** Avatar/cover are multipart, field `file`, capped at 5 MB by the backend. */
export async function uploadMyPhoto(
  kind: "avatar" | "cover",
  asset: { uri: string; name: string; type: string },
): Promise<BackendUser> {
  const form = new FormData();
  form.append("file", {
    uri: asset.uri,
    name: asset.name,
    type: asset.type,
  } as unknown as Blob);
  const { data } = await apiFetch<BackendUser>(`/users/me/${kind}`, {
    method: "POST",
    body: form,
  });
  return data;
}

export async function fetchMyDevices(): Promise<MyDevice[]> {
  const { data } = await apiFetch<MyDevice[]>("/auth/devices");
  return data ?? [];
}

export async function revokeMyDevice(id: string): Promise<void> {
  await apiFetch<unknown>(`/auth/devices/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function revokeOtherDevices(): Promise<void> {
  await apiFetch<unknown>("/auth/devices/revoke-others", { method: "POST" });
}

export async function deleteMyAccount(password: string): Promise<void> {
  await apiFetch<unknown>("/users/me", {
    method: "DELETE",
    body: { password },
  });
}

export async function fetchMyPhones(): Promise<MyPhone[]> {
  const { data } = await apiFetch<MyPhone[]>("/users/me/phones");
  return data ?? [];
}

export async function requestPhoneChange(phone: string): Promise<void> {
  await apiFetch<unknown>("/users/me/phones/otp", {
    method: "POST",
    body: { phone },
  });
}

export async function verifyPhoneChange(
  phone: string,
  token: string,
): Promise<void> {
  await apiFetch<unknown>("/users/me/phones/otp/verify", {
    method: "POST",
    body: { phone, token },
  });
}

const MY_ADS_STATUS: Record<Exclude<MyAdsTab, "all">, string> = {
  active: "active",
  expired: "expired",
  hidden: "restricted",
};

export async function fetchMyAds(
  tab: MyAdsTab,
  page = 1,
  pageSize = 20,
): Promise<MyAdsPage> {
  const status = tab === "all" ? "" : `&status=${MY_ADS_STATUS[tab]}`;
  const { data, meta } = await apiFetch<ListingDetail[]>(
    `/listings/me/all?limit=${pageSize}&page=${page}${status}`,
  );
  return {
    items: data ?? [],
    total: Number(meta?.total ?? 0),
    hasMore: Boolean(meta?.hasMore),
  };
}

export async function fetchMyReactionsList(
  kind: "likes" | "saves",
  page = 1,
  pageSize = 20,
): Promise<{ items: ListingDetail[]; total: number; hasMore: boolean }> {
  const { data, meta } = await apiFetch<ListingDetail[]>(
    `/users/me/${kind}?page=${page}&pageSize=${pageSize}`,
  );
  return {
    items: data ?? [],
    total: Number(meta?.total ?? 0),
    hasMore: Boolean(meta?.hasMore),
  };
}

export async function fetchMyFollowCounts(): Promise<{
  followers: number;
  following: number;
}> {
  const { data } = await apiFetch<{ followers: number; following: number }>(
    "/users/me/follow-counts",
  );
  return data;
}
