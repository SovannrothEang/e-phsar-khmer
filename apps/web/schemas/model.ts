import { z } from "zod";

export const modelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Model name is required")
    .max(50, "Model name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Model slug is required")
    .max(50, "Model slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Model slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  brandId: z.string().min(1, "Brand ID is required"),
  categoryId: z.string().min(1, "Category ID is required"),
  subcategories: z.array(z.string()).min(1, "Select at least one subcategory"),
});

export const deleteModelSchema = z.object({
  modelId: z.string().min(1, "Model ID is required"),
});
