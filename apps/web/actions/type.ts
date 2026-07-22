"use server"

import { typeSchema, deleteTypeSchema } from "@/schemas/type"
import z from "zod"

export async function createType(unsafeData: z.infer<typeof typeSchema>) {
  const data = typeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateType(unsafeData: z.infer<typeof typeSchema>) {
  const data = typeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteType(unsafeData: z.infer<typeof deleteTypeSchema>) {
  const data = deleteTypeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid type ID" }

  // Save to DB

  return { success: true }
}