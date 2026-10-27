"use server";

import { ApiError, serverFetch } from "@/lib/api/client";
import {
  deleteProductSchema,
  productSchema,
  updateProductSchema,
} from "@/schemas/product";
import z from "zod";

export async function createProduct(unsafeData: z.infer<typeof productSchema>) {
  const parsed = productSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch("/admin/products", {
      method: "POST",
      body: JSON.stringify({
        modelId: parsed.data.modelId,
        specGroups: parsed.data.specGroups,
        isPublished: parsed.data.isPublished,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to create product spec";
    return { success: false, error: message };
  }
}

export async function updateProduct(
  productId: string,
  unsafeData: z.infer<typeof updateProductSchema>,
) {
  const parsed = updateProductSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  try {
    await serverFetch(`/admin/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({
        specGroups: parsed.data.specGroups,
        isPublished: parsed.data.isPublished,
      }),
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to update product spec";
    return { success: false, error: message };
  }
}

export async function deleteProduct(
  unsafeData: z.infer<typeof deleteProductSchema>,
) {
  const parsed = deleteProductSchema.safeParse(unsafeData);
  if (!parsed.success) return { success: false, error: "Invalid product ID" };

  try {
    await serverFetch(`/admin/products/${parsed.data.productId}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Failed to delete product spec";
    return { success: false, error: message };
  }
}
