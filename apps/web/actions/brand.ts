"use server";

import { brandSchema, deleteBrandSchema } from "@/schemas/brand";
import { serverFetch, ApiError } from "@/lib/api/client";
import z from "zod";

// The form's categoryId is a UI helper only (filters the subcategory list); the
// backend persists brand → subcategory links. `image` is uploaded via
// /files/sign (scope=brand) and persisted as the brand's `icon` column.

export async function createBrand(unsafeData: z.infer<typeof brandSchema>) {
  const parsed = brandSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch("/admin/brands", {
      method: "POST",
      body: JSON.stringify({
        slug: parsed.data.slug,
        name: parsed.data.name,
        subcategoryIds: parsed.data.subcategories,
        icon: parsed.data.image || null,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to create brand";
    return { success: false, error: message };
  }
}

export async function updateBrand(
  brandId: string,
  unsafeData: z.infer<typeof brandSchema>,
) {
  const parsed = brandSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch(`/admin/brands/${brandId}`, {
      method: "PATCH",
      body: JSON.stringify({
        slug: parsed.data.slug,
        name: parsed.data.name,
        subcategoryIds: parsed.data.subcategories,
        icon: parsed.data.image || null,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to update brand";
    return { success: false, error: message };
  }
}

export async function deleteBrand(
  unsafeData: z.infer<typeof deleteBrandSchema>,
) {
  const parsed = deleteBrandSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid brand ID" };

  try {
    await serverFetch(`/admin/brands/${parsed.data.brandId}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to delete brand";
    return { success: false, error: message };
  }
}
