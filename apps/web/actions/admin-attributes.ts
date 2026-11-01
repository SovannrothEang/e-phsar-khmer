"use server";

import { serverFetch, ApiError } from "@/lib/api/client";

/** Generic attribute-option shape shared by every attribute page. */
export interface AdminAttribute {
  id: string;
  name: string;
  nameKm: string | null;
  slug: string;
  image: string | null;
  categoryId: string;
  subcategories: string[];
  createdAt: string;
  updatedAt: string;
}

interface BackendAttribute {
  id: string;
  name: string;
  nameKm: string | null;
  slug: string;
  image: string | null;
  categoryId: string | null;
  subcategoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AttributeInput {
  name: string;
  nameKm?: string;
  slug: string;
  image?: string;
  categoryId?: string;
  subcategoryIds: string[];
}

export async function getAdminAttributes(
  type: string,
): Promise<AdminAttribute[]> {
  const { data } = await serverFetch<BackendAttribute[]>(
    `/admin/attributes/${type}`,
  );
  return data.map((a) => ({
    id: a.id,
    name: a.name,
    nameKm: a.nameKm ?? null,
    slug: a.slug,
    image: a.image,
    categoryId: a.categoryId ?? "",
    subcategories: a.subcategoryIds ?? [],
    createdAt: a.createdAt.slice(0, 10),
    updatedAt: a.updatedAt.slice(0, 10),
  }));
}

function body(input: AttributeInput) {
  return JSON.stringify({
    name: input.name,
    nameKm: input.nameKm || null,
    slug: input.slug,
    image: input.image || null,
    categoryId: input.categoryId || undefined,
    subcategoryIds: input.subcategoryIds,
  });
}

export async function createAttribute(type: string, input: AttributeInput) {
  try {
    await serverFetch(`/admin/attributes/${type}`, {
      method: "POST",
      body: body(input),
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Failed to save",
    };
  }
}

export async function updateAttribute(
  type: string,
  id: string,
  input: AttributeInput,
) {
  try {
    await serverFetch(`/admin/attributes/${type}/${id}`, {
      method: "PATCH",
      body: body(input),
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Failed to save",
    };
  }
}

export async function deleteAttribute(type: string, id: string) {
  try {
    await serverFetch(`/admin/attributes/${type}/${id}`, { method: "DELETE" });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Failed to delete",
    };
  }
}
