"use server"

import { categorySchema, deleteCategorySchema } from "@/schemas/category"
import z from "zod"

export async function createcategories(unsafeData: z.infer<typeof categorySchema>) {
  const data = categorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updatecategories(unsafeData: z.infer<typeof categorySchema>) {
  const data = categorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deletecategories(unsafeData: z.infer<typeof deleteCategorySchema>) {
  const data = deleteCategorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid category ID" }

  // Save to DB

  return { success: true }
}