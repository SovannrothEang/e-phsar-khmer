import { z } from "zod"

export const accessorySchema = z.object({
  
  name: z
    .string()
    .trim()
    .min(1, "accessory name is required")
    .max(50, "accessory name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "accessory slug is required")
    .max(50, "accessory slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "accessory slug must be lowercase with hyphens only (e.g. my-category)"
    ),
  image: z.string(),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
})

export const deleteAccessorySchema = z.object({
  accessoryId: z.string().min(1, "accessory ID is required"),
})
