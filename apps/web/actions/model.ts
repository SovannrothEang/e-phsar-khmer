"use server"

import { modelSchema, deleteModelSchema } from "@/schemas/model"
import z from "zod"

export async function createModel(unsafeData: z.infer<typeof modelSchema>) {
  const data = modelSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateModel(unsafeData: z.infer<typeof modelSchema>) {
  const data = modelSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteModel(unsafeData: z.infer<typeof deleteModelSchema>) {
  const data = deleteModelSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid brand ID" }

  // Save to DB

  return { success: true }
}