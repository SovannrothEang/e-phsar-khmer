import { z } from "zod";

export const ramSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "RAM name is required")
    .max(50, "RAM name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "RAM slug is required")
    .max(50, "RAM slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "RAM slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
});

export const deleteRamSchema = z.object({
  ramId: z.string().min(1, "RAM ID is required"),
});
