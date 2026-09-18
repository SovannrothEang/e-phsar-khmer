import { z } from "zod";

export const experienceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Experience name is required")
    .max(50, "Experience name must be less than 50 characters"),
  slug: z
    .string()
    .trim()
    .min(1, "Experience slug is required")
    .max(50, "Experience slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Experience slug must be lowercase with hyphens only (e.g. my-category)",
    ),
  categoryId: z.string().min(1, "Category is required"),
});

export const deleteExperienceSchema = z.object({
  experienceId: z.string().min(1, "experience ID is required"),
});
