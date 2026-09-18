"use server";

import { storageSchema, deleteStorageSchema } from "@/schemas/storage";
import z from "zod";

export async function createStorage(unsafeData: z.infer<typeof storageSchema>) {
  const data = storageSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateStorage(unsafeData: z.infer<typeof storageSchema>) {
  const data = storageSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteStorage(
  unsafeData: z.infer<typeof deleteStorageSchema>,
) {
  const data = deleteStorageSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid storage ID" };

  // Save to DB

  return { success: true };
}
