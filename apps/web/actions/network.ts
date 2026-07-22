"use server"

import { networkSchema, deleteNetworkSchema } from "@/schemas/network"
import z from "zod"

export async function createNetwork(unsafeData: z.infer<typeof networkSchema>) {
  const data = networkSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateNetwork(unsafeData: z.infer<typeof networkSchema>) {
  const data = networkSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteNetwork(unsafeData: z.infer<typeof deleteNetworkSchema>) {
  const data = deleteNetworkSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid network ID" }

  // Save to DB

  return { success: true }
}