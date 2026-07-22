"use server"

import { engineTypeSchema, deleteEngineTypeSchema } from "@/schemas/engine-type"
import z from "zod"

export async function createEngineType(unsafeData: z.infer<typeof engineTypeSchema>) {
  const data = engineTypeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateEngineType(unsafeData: z.infer<typeof engineTypeSchema>) {
  const data = engineTypeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteEngineType(unsafeData: z.infer<typeof deleteEngineTypeSchema>) {
  const data = deleteEngineTypeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid engine type ID" }

  // Save to DB

  return { success: true }
}