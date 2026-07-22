import { z } from "zod"

export const cpuSchema = z.object({
  
  name: z
    .string()
    .trim()
    .min(1, "CPU name is required")
    .max(50, "CPU name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "CPU slug is required")
    .max(50, "CPU slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "CPU slug must be lowercase with hyphens only (e.g. my-category)"
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
})

export const deleteCpuSchema = z.object({
  cpuId: z.string().min(1, "CPU ID is required"),
})
