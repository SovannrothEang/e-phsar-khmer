"use server";

import { serverFetch, ApiError } from "@/lib/api/client";

// ── Row shapes (backend returns numeric price/discount as strings) ──
export interface SubCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SubPlan extends SubCategory {
  categoryId: string;
}
export interface SubPackage {
  id: string;
  planId: string;
  name: string;
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SubTerm {
  id: string;
  packageId: string;
  name: string;
  durationValue: number;
  durationUnit: "day" | "month" | "year";
  price: string;
  discount: string;
  discountType: "percent" | "amount";
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Result = { success: true } | { success: false; error: string };

async function mutate(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  bodyObj?: unknown,
): Promise<Result> {
  try {
    await serverFetch(path, {
      method,
      body: bodyObj ? JSON.stringify(bodyObj) : undefined,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Request failed",
    };
  }
}

// ── Categories ──────────────────────────────────────────────
export async function getSubCategories(): Promise<SubCategory[]> {
  const { data } = await serverFetch<SubCategory[]>(
    "/admin/subscriptions/categories",
  );
  return data;
}
export async function createSubCategory(b: unknown) {
  return mutate("/admin/subscriptions/categories", "POST", b);
}
export async function updateSubCategory(id: string, b: unknown) {
  return mutate(`/admin/subscriptions/categories/${id}`, "PATCH", b);
}
export async function deleteSubCategory(id: string) {
  return mutate(`/admin/subscriptions/categories/${id}`, "DELETE");
}

// ── Plans ───────────────────────────────────────────────────
export async function getSubPlans(categoryId?: string): Promise<SubPlan[]> {
  const qs = categoryId ? `?categoryId=${categoryId}` : "";
  const { data } = await serverFetch<SubPlan[]>(
    `/admin/subscriptions/plans${qs}`,
  );
  return data;
}
export async function createSubPlan(b: unknown) {
  return mutate("/admin/subscriptions/plans", "POST", b);
}
export async function updateSubPlan(id: string, b: unknown) {
  return mutate(`/admin/subscriptions/plans/${id}`, "PATCH", b);
}
export async function deleteSubPlan(id: string) {
  return mutate(`/admin/subscriptions/plans/${id}`, "DELETE");
}

// ── Packages ────────────────────────────────────────────────
export async function getSubPackages(planId?: string): Promise<SubPackage[]> {
  const qs = planId ? `?planId=${planId}` : "";
  const { data } = await serverFetch<SubPackage[]>(
    `/admin/subscriptions/packages${qs}`,
  );
  return data;
}
export async function createSubPackage(b: unknown) {
  return mutate("/admin/subscriptions/packages", "POST", b);
}
export async function updateSubPackage(id: string, b: unknown) {
  return mutate(`/admin/subscriptions/packages/${id}`, "PATCH", b);
}
export async function deleteSubPackage(id: string) {
  return mutate(`/admin/subscriptions/packages/${id}`, "DELETE");
}

// ── Terms ───────────────────────────────────────────────────
export async function getSubTerms(packageId?: string): Promise<SubTerm[]> {
  const qs = packageId ? `?packageId=${packageId}` : "";
  const { data } = await serverFetch<SubTerm[]>(
    `/admin/subscriptions/terms${qs}`,
  );
  return data;
}
export async function createSubTerm(b: unknown) {
  return mutate("/admin/subscriptions/terms", "POST", b);
}
export async function updateSubTerm(id: string, b: unknown) {
  return mutate(`/admin/subscriptions/terms/${id}`, "PATCH", b);
}
export async function deleteSubTerm(id: string) {
  return mutate(`/admin/subscriptions/terms/${id}`, "DELETE");
}
