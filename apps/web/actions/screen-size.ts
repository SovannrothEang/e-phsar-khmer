"use server"

import { screenSizeSchema, deleteScreenSizeSchema } from "@/schemas/screen-size"
import z from "zod"

export async function createScreenSize(unsafeData: z.infer<typeof screenSizeSchema>) {
  const data = screenSizeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function updateScreenSize(unsafeData: z.infer<typeof screenSizeSchema>) {
  const data = screenSizeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
export async function deleteScreenSize(unsafeData: z.infer<typeof deleteScreenSizeSchema>) {
  const data = deleteScreenSizeSchema.safeParse(unsafeData)

  if (!data.success) return { success: false, error: "Invalid screen size ID" }

  // Save to DB

  return { success: true }
}