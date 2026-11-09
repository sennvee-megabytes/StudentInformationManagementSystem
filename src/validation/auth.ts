import { z } from "zod";
import { passwordSchema } from "@/lib/password";

export const COMMON_PASSWORDS = new Set([
  "password123",
  "password1234",
  "1234567890",
  "12345678901",
  "qwerty12345",
  "qwertyuiop",
  "admin12345",
  "welcome123",
  "letmein123",
  "cvsu123456",
  "student1234",
  "registrar123",
]);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(32, "Username must be at most 32 characters.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dots, underscores, and hyphens.")
  .transform((v) => v.toLowerCase());

export const loginSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(1, "Password is required.").max(128, "Password is too long."),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(128),
    newPassword: passwordSchema.refine(
      (val) => !COMMON_PASSWORDS.has(val.toLowerCase()),
      "This password is too common. Choose a stronger password."
    ),
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from your current password.",
    path: ["newPassword"],
  });

export function validatePasswordAgainstUsername(password: string, username: string): string | null {
  const normPass = password.toLowerCase();
  const normUser = username.toLowerCase();
  if (normPass === normUser || normPass.includes(normUser)) {
    return "Password must not contain your username.";
  }
  if (COMMON_PASSWORDS.has(normPass)) {
    return "This password is too common. Choose a stronger password.";
  }
  return null;
}

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
