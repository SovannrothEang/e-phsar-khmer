"use server"

import { accessorySchema, deleteAccessorySchema } from "@/schemas/accessory"
import z from "zod"

export async function createAccessory(unsafeData: z.infer<typeof accessorySchema>) {
  const data = accessorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateAccessory(unsafeData: z.infer<typeof accessorySchema>) {
  const data = accessorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteAccessory(unsafeData: z.infer<typeof deleteAccessorySchema>) {
  const data = deleteAccessorySchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid accessory ID" }

  // Save to DB

  return { success: true }
}