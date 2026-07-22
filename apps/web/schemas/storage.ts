import { z } from "zod"

export const storageSchema = z.object({
  
  name: z
    .string()
    .trim()
    .min(1, "Storage name is required")
    .max(50, "Storage name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Storage slug is required")
    .max(50, "Storage slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Storage slug must be lowercase with hyphens only (e.g. my-category)"
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
})

export const deleteStorageSchema = z.object({
  storageId: z.string().min(1, "storage ID is required"),
})
