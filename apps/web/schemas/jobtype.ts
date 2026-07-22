import { z } from "zod"

export const jobtypeSchema = z.object({
  
  name: z
    .string()
    .trim()
    .min(1, "type name is required")
    .max(50, "type name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "type slug is required")
    .max(50, "type slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "type slug must be lowercase with hyphens only (e.g. my-category)"
    ),
  image: z.string(),
  categoryId: z.string().min(1, "Category is required"),
})

export const deleteJobtypeSchema = z.object({
  jobtypeId: z.string().min(1, "Jobtype ID is required"),
})
