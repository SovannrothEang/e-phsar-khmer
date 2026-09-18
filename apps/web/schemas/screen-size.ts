import { z } from "zod";

export const screenSizeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Screen size name is required")
    .max(50, "Screen size name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Screen size slug is required")
    .max(50, "Screen size slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Screen size slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  categoryId: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
});

export const deleteScreenSizeSchema = z.object({
  screenSizeId: z.string().min(1, "screen size ID is required"),
});
