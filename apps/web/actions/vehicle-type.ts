"use server";

import {
  vehicletypeSchema,
  deleteVehicletypeSchema,
} from "@/schemas/vehicle-type";
import z from "zod";

export async function createVehicletype(
  unsafeData: z.infer<typeof vehicletypeSchema>,
) {
  const data = vehicletypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function updateVehicletype(
  unsafeData: z.infer<typeof vehicletypeSchema>,
) {
  const data = vehicletypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false };

  // Save to DB

  return { success: true };
}
export async function deleteVehicletype(
  unsafeData: z.infer<typeof deleteVehicletypeSchema>,
) {
  const data = deleteVehicletypeSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid vehicletype ID" };

  // Save to DB

  return { success: true };
}
