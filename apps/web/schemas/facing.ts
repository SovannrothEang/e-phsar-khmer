import { z } from "zod"

export const facingSchema = z.object({
  
  name: z
    .string()
    .trim()
    .min(1, "Facing name is required")
    .max(50, "Facing name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Facing slug is required")
    .max(50, "Facing slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Facing slug must be lowercase with hyphens only (e.g. my-category)"
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
})

export const deleteFacingSchema = z.object({
  facingId: z.string().min(1, "facing ID is required"),
})
