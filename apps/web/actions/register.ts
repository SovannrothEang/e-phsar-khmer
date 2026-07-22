"use server"

import { registerSchema } from "@/schemas/register"
import z from "zod"

export async function register(unsafeData: z.infer<typeof registerSchema>) {
  const data = registerSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}