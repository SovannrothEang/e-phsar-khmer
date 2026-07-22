import { z } from "zod"

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Category name must be less than 100 characters"),

  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100, "Slug must be less than 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase with hyphens only (e.g. my-category)"
    ),

  cateIcon: z.string(),
})

export const deleteCategorySchema = z.object({
  cateId: z.string().min(1, "Category ID is required"),
})
