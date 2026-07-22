"use server"

import { facingSchema, deleteFacingSchema } from "@/schemas/facing"
import z from "zod"

export async function createFacing(unsafeData: z.infer<typeof facingSchema>) {
  const data = facingSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateFacing(unsafeData: z.infer<typeof facingSchema>) {
  const data = facingSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteFacing(unsafeData: z.infer<typeof deleteFacingSchema>) {
  const data = deleteFacingSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid facing ID" }

  // Save to DB

  return { success: true }
}