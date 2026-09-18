"use server";

import { bodytypeSchema, deleteBodytypeSchema } from "@/schemas/body-type";
import z from "zod";

export async function createBodytype(
  unsafeData: z.infer<typeof bodytypeSchema>,
) {
  const data = bodytypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateBodytype(
  unsafeData: z.infer<typeof bodytypeSchema>,
) {
  const data = bodytypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteBodytype(
  unsafeData: z.infer<typeof deleteBodytypeSchema>,
) {
  const data = deleteBodytypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid bodytype ID" };

  // Save to DB

  return { success: true };
}
