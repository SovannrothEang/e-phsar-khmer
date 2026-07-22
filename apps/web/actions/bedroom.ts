"use server"

import { bedroomSchema, deleteBedroomSchema } from "@/schemas/bedroom"
import z from "zod"

export async function createBedroom(unsafeData: z.infer<typeof bedroomSchema>) {
  const data = bedroomSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateBedroom(unsafeData: z.infer<typeof bedroomSchema>) {
  const data = bedroomSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteBedroom(unsafeData: z.infer<typeof deleteBedroomSchema>) {
  const data = deleteBedroomSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid bedroom ID" }

  // Save to DB

  return { success: true }
}