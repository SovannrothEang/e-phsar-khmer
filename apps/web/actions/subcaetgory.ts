"use server";

import { subCategorySchema } from "@/schemas/subcategories";
import { serverFetch, ApiError } from "@/lib/api/client";
import z from "zod";

export async function createsubcategories(
  unsafeData: z.infer<typeof subCategorySchema>,
) {
  const parsed = subCategorySchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch("/admin/subcategories", {
      method: "POST",
      body: JSON.stringify({
        categoryId: parsed.data.categoryId,
        slug: parsed.data.slug,
        name: parsed.data.name,
        icon: parsed.data.subIcon || null,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to create subcategory";
    return { success: false, error: message };
  }
}

export async function updatesubcategories(
  subId: string,
  unsafeData: z.infer<typeof subCategorySchema>,
) {
  const parsed = subCategorySchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch(`/admin/subcategories/${subId}`, {
      method: "PATCH",
      body: JSON.stringify({
        categoryId: parsed.data.categoryId,
        slug: parsed.data.slug,
        name: parsed.data.name,
        icon:
          parsed.data.subIcon && parsed.data.subIcon !== "/placeholder.svg"
            ? parsed.data.subIcon
            : null,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to update subcategory";
    return { success: false, error: message };
  }
}

export async function deletesubcategories(subId: string) {
  if (!subId) return { success: false, error: "Invalid subcategory ID" };

  try {
    await serverFetch(`/admin/subcategories/${subId}`, { method: "DELETE" });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to delete subcategory";
    return { success: false, error: message };
  }
}
