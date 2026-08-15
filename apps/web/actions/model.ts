"use server";

import { modelSchema, deleteModelSchema } from "@/schemas/model";
import { serverFetch, ApiError } from "@/lib/api/client";
import z from "zod";

// The form's categoryId + subcategories are UI-only (they drive the cascade to
// pick a brand); the backend model only needs brandId + slug + name.

export async function createModel(unsafeData: z.infer<typeof modelSchema>) {
  const parsed = modelSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch("/admin/models", {
      method: "POST",
      body: JSON.stringify({
        brandId: parsed.data.brandId,
        slug: parsed.data.slug,
        name: parsed.data.name,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to create model";
    return { success: false, error: message };
  }
}

export async function updateModel(
  modelId: string,
  unsafeData: z.infer<typeof modelSchema>,
) {
  const parsed = modelSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch(`/admin/models/${modelId}`, {
      method: "PATCH",
      body: JSON.stringify({
        brandId: parsed.data.brandId,
        slug: parsed.data.slug,
        name: parsed.data.name,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to update model";
    return { success: false, error: message };
  }
}

export async function deleteModel(
  unsafeData: z.infer<typeof deleteModelSchema>,
) {
  const parsed = deleteModelSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid model ID" };

  try {
    await serverFetch(`/admin/models/${parsed.data.modelId}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to delete model";
    return { success: false, error: message };
  }
}
