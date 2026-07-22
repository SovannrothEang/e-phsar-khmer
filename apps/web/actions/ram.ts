"use server"

import { ramSchema, deleteRamSchema } from "@/schemas/ram"
import z from "zod"

export async function createRam(unsafeData: z.infer<typeof ramSchema>) {
  const data = ramSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateRam(unsafeData: z.infer<typeof ramSchema>) {
  const data = ramSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteRam(unsafeData: z.infer<typeof deleteRamSchema>) {
  const data = deleteRamSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid RAM ID" }

  // Save to DB

  return { success: true }
}