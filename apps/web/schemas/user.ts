import { z } from "zod";

export const USER_ROLES = ["super_admin", "admin", "user"] as const;

export const usersSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email"),
  profile: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phones: z
    .array(
      z.object({
        phone: z.string().min(1, "Phone is required"),
      }),
    )
    .min(1, "At least one phone number is required")
    .max(3, "Maximum 3 phone numbers"),
  role: z.enum(USER_ROLES),
});

export const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email"),
  profile: z.string(),
  password: z.string(),
  phones: z
    .array(
      z.object({
        phone: z.string().min(1, "Phone is required"),
      }),
    )
    .min(1, "At least one phone number is required")
    .max(3, "Maximum 3 phone numbers"),
  role: z.enum(USER_ROLES),
});

export const deleteUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});
