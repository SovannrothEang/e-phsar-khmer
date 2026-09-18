import { z } from "zod";

export const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, "Please enter your phone number, username, or email"),

  password: z
    .string()
    .min(8, "Your password must be at least 8 characters long."),
});
