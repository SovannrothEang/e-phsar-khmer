import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(2, "Your last name must be at least 2 characters long."),
    lastName: z
      .string()
      .min(2, "Your first name must be at least 2 characters long."),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^0\d{7,9}$/, "Invalid phone number."),
    password: z
      .string()
      .min(8, "Your password must be at least 8 characters long."),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Your password and confirm password do not match.",
    path: ["confirmPassword"],
  });
