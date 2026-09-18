import { z } from "zod";

export const bedroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "bedroom name is required")
    .max(50, "bedroom name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "bedroom slug is required")
    .max(50, "bedroom slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "bedroom slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
});

export const deleteBedroomSchema = z.object({
  bedroomId: z.string().min(1, "bedroom ID is required"),
});
