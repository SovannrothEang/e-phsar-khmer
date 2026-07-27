"use server";

import { categorySchema, deleteCategorySchema } from "@/schemas/category";
import { serverFetch, ApiError } from "@/lib/api/client";
import z from "zod";

export async function createcategories(
  unsafeData: z.infer<typeof categorySchema>,
) {
  const parsed = categorySchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch("/admin/categories", {
      method: "POST",
      body: JSON.stringify({
        slug: parsed.data.slug,
        name: parsed.data.name,
        icon: parsed.data.cateIcon || null,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to create category";
    return { success: false, error: message };
  }
}

export async function updatecategories(
  cateId: string,
  unsafeData: z.infer<typeof categorySchema>,
) {
  const parsed = categorySchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch(`/admin/categories/${cateId}`, {
      method: "PATCH",
      body: JSON.stringify({
        slug: parsed.data.slug,
        name: parsed.data.name,
        icon: parsed.data.cateIcon || null,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to update category";
    return { success: false, error: message };
  }
}

export async function deletecategories(
  unsafeData: z.infer<typeof deleteCategorySchema>,
) {
  const parsed = deleteCategorySchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid category ID" };

  try {
    await serverFetch(`/admin/categories/${parsed.data.cateId}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to delete category";
    return { success: false, error: message };
  }
}
