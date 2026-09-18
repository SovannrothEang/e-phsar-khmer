import { z } from "zod";

export const vehicletypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "vehicletype name is required")
    .max(50, "vehicletype name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "vehicletype slug is required")
    .max(50, "vehicletype slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "vehicletype slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  image: z.string(),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
});

export const deleteVehicletypeSchema = z.object({
  vehicletypeId: z.string().min(1, "Vehicle ID is required"),
});
