import { z } from "zod";

export const engineTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "engineType name is required")
    .max(50, "engineType name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "engineType slug is required")
    .max(50, "engineType slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "engineType slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
});

export const deleteEngineTypeSchema = z.object({
  enginetypeId: z.string().min(1, "engineType ID is required"),
});
