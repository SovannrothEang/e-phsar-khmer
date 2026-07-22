import { z } from "zod"

export const vgaSchema = z.object({
  
  name: z
    .string()
    .trim()
    .min(1, "VGA name is required")
    .max(50, "VGA name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "VGA slug is required")
    .max(50, "VGA slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "VGA slug must be lowercase with hyphens only (e.g. my-category)"
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
})

export const deleteVgaSchema = z.object({
  vgaId: z.string().min(1, "VGA ID is required"),
})
