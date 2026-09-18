"use server";

import { cpuSchema, deleteCpuSchema } from "@/schemas/cpu";
import z from "zod";

export async function createCpu(unsafeData: z.infer<typeof cpuSchema>) {
  const data = cpuSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateCpu(unsafeData: z.infer<typeof cpuSchema>) {
  const data = cpuSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteCpu(unsafeData: z.infer<typeof deleteCpuSchema>) {
  const data = deleteCpuSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid CPU ID" };

  // Save to DB

  return { success: true };
}
