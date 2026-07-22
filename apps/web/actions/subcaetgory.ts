"use server"

import { subCategorySchema } from "@/schemas/subcategories"
import z from "zod"

export async function createsubcategories(unsafeData: z.infer<typeof subCategorySchema>) {
  const data = subCategorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updatesubcategories(unsafeData: z.infer<typeof subCategorySchema>) {
  const data = subCategorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deletesubcategories(unsafeData: z.infer<typeof subCategorySchema>) {
  const data = subCategorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}