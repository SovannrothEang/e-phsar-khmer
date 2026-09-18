"use server";

import { jobtypeSchema, deleteJobtypeSchema } from "@/schemas/jobtype";
import z from "zod";

export async function createJobtype(unsafeData: z.infer<typeof jobtypeSchema>) {
  const data = jobtypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateJobtype(unsafeData: z.infer<typeof jobtypeSchema>) {
  const data = jobtypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteJobtype(
  unsafeData: z.infer<typeof deleteJobtypeSchema>,
) {
  const data = deleteJobtypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid jobtype ID" };

  // Save to DB

  return { success: true };
}
