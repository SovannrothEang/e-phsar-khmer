"use server"

import { brandSchema, deleteBrandSchema } from "@/schemas/brand"
import z from "zod"

export async function createBrand(unsafeData: z.infer<typeof brandSchema>) {
  const data = brandSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateBrand(unsafeData: z.infer<typeof brandSchema>) {
  const data = brandSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteBrand(unsafeData: z.infer<typeof deleteBrandSchema>) {
  const data = deleteBrandSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid brand ID" }

  // Save to DB

  return { success: true }
}