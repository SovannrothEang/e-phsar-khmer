"use server";

import { bathroomSchema, deleteBathroomSchema } from "@/schemas/bathroom";
import z from "zod";

export async function createBathroom(
  unsafeData: z.infer<typeof bathroomSchema>,
) {
  const data = bathroomSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateBathroom(
  unsafeData: z.infer<typeof bathroomSchema>,
) {
  const data = bathroomSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteBathroom(
  unsafeData: z.infer<typeof deleteBathroomSchema>,
) {
  const data = deleteBathroomSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid bathroom ID" };

  // Save to DB

  return { success: true };
}
