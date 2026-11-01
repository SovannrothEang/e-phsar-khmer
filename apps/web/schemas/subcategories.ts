import { z } from "zod";

export const subCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "SubCategory name is required")
    .max(50, "SubCategory name must be less than 50 characters"),

  nameKm: z
    .string()
    .trim()
    .max(200, "Khmer name must be less than 200 characters"),

  slug: z
    .string()
    .trim()
    .min(1, "SubSlug is required")
    .max(50, "SubSlug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "SubSlug must be lowercase with hyphens only (e.g. my-category)",
    ),

  subIcon: z.string(),
  categoryId: z.string(),
});
