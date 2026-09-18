"use server";

import { experienceSchema, deleteExperienceSchema } from "@/schemas/experience";
import z from "zod";

export async function createExperience(
  unsafeData: z.infer<typeof experienceSchema>,
) {
  const data = experienceSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateExperience(
  unsafeData: z.infer<typeof experienceSchema>,
) {
  const data = experienceSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteExperience(
  unsafeData: z.infer<typeof deleteExperienceSchema>,
) {
  const data = deleteExperienceSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid experience ID" };

  // Save to DB

  return { success: true };
}
