import { z } from "zod"

export const bodytypeSchema = z.object({
  
  name: z
    .string()
    .trim()
    .min(1, "bodytype name is required")
    .max(50, "bodytype name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "bodytype slug is required")
    .max(50, "bodytype slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "bodytype slug must be lowercase with hyphens only (e.g. my-category)"
    ),
  image: z.string(),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
})

export const deleteBodytypeSchema = z.object({
  bodytypeId: z.string().min(1, "Brand ID is required"),
})
