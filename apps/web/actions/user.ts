"use server"

import { deleteUserSchema, editUserSchema, usersSchema } from "@/schemas/user"
import z from "zod"

export async function createUser(unsafeData: z.infer<typeof usersSchema>) {
  const data = usersSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}

export async function updateUser(unsafeData: z.infer<typeof editUserSchema>) {
  const data = editUserSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}

export async function deleteUser(unsafeData: z.infer<typeof deleteUserSchema>) {
  const data = deleteUserSchema.safeParse(unsafeData)

  if (!data.success) return { success: false }

  // Save to DB

  return { success: true }
}
