import { z } from "zod";

export const bathroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "bathroom name is required")
    .max(50, "bathroom name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "bathroom slug is required")
    .max(50, "bathroom slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "bathroom slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
});

export const deleteBathroomSchema = z.object({
  bathroomId: z.string().min(1, "bathroom ID is required"),
});
