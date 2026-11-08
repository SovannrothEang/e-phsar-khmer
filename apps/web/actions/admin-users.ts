"use server";

import { serverFetch } from "@/lib/api/client";
import { toUiUser, type BackendUser } from "@/lib/api/adapters";
import type { User } from "@/types/user";

export interface AdminUsersResult {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetAdminUsersParams {
  q?: string;
  role?: "user" | "admin" | "super_admin";
  /** Account state. Omitted = every state. */
  status?: "active" | "suspended" | "deleted";
  page?: number;
  pageSize?: number;
}

export async function getAdminUsers(
  params?: GetAdminUsersParams,
): Promise<AdminUsersResult> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  // Only the Users page filters by status; the Team feed leaves it out.
  if (params?.status) sp.set("status", params.status);
  sp.set("role", params?.role ?? "user");
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));

  const { data, meta } = await serverFetch<BackendUser[]>(
    `/admin/users?${sp.toString()}`,
  );
  return {
    users: data.map(toUiUser),
    total: meta?.total ?? data.length,
    page,
    pageSize,
  };
}

/** The staff tiers the Team page lists; customers belong to the Users page. */
const TEAM_ROLES = ["admin", "super_admin"] as const;

/**
 * Team page feed: every staff account, both tiers. The admin endpoint filters
 * by a single role, so fetch each tier and merge — newest first, the same
 * order `listUsers` returns within one role.
 */
export async function getTeamUsers(
  params?: Omit<GetAdminUsersParams, "role">,
): Promise<AdminUsersResult> {
  const results = await Promise.all(
    TEAM_ROLES.map((role) => getAdminUsers({ ...params, role })),
  );
  const users = results
    .flatMap((result) => result.users)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  // The team list is small enough to page client-side; the metadata exists to
  // satisfy the shared result shape.
  return { users, total: users.length, page: 1, pageSize: users.length };
}
