"use server";

import { vgaSchema, deleteVgaSchema } from "@/schemas/vga";
import z from "zod";

export async function createVga(unsafeData: z.infer<typeof vgaSchema>) {
  const data = vgaSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateVga(unsafeData: z.infer<typeof vgaSchema>) {
  const data = vgaSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteVga(unsafeData: z.infer<typeof deleteVgaSchema>) {
  const data = deleteVgaSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid VGA ID" };

  // Save to DB

  return { success: true };
}
