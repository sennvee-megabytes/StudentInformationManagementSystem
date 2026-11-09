import { z } from "zod";
import { usernameSchema } from "@/validation/auth";

export const schoolYearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, "School year must be in YYYY-YYYY format (e.g. 2026-2027).")
  .refine((val) => {
    const [start, end] = val.split("-").map(Number);
    return end === start + 1;
  }, "Second year in school year must equal first year + 1 (e.g. 2026-2027).");

export const programCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Program code must be at least 2 characters.")
      .max(16, "Program code must be at most 16 characters.")
      .regex(/^[A-Za-z0-9-]+$/, "Program code may only contain letters, numbers, and hyphens.")
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(3, "Program name is required.").max(120),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const programUpdateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(16)
      .regex(/^[A-Za-z0-9-]+$/)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const sectionCreateSchema = z
  .object({
    programId: z.string().uuid("Select a valid program."),
    yearLevel: z.number().int().min(1).max(6),
    name: z
      .string()
      .trim()
      .min(1, "Section name is required (e.g. A, 1, 1-A).")
      .max(24)
      .regex(/^[A-Za-z0-9-]+$/, "Section name may only contain letters, numbers, and hyphens."),
    schoolYear: schoolYearSchema,
    capacity: z.number().int().min(1, "Capacity must be greater than 0.").max(500).nullable().optional(),
  })
  .strict();

export const sectionUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[A-Za-z0-9-]+$/)
      .optional(),
    capacity: z.number().int().min(1).max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const staffUserCreateSchema = z
  .object({
    username: usernameSchema,
    email: z.string().trim().email().max(254).nullable().optional(),
    role: z.enum(["STAFF", "ADMIN"]),
  })
  .strict();

export const staffUserUpdateSchema = z
  .object({
    email: z.string().trim().email().max(254).nullable().optional(),
    role: z.enum(["STAFF", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    unlock: z.boolean().optional(),
    resetPassword: z.boolean().optional(),
  })
  .strict();

export const studentAccountUpdateSchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    unlock: z.boolean().optional(),
  })
  .strict();

export type ProgramCreateInput = z.infer<typeof programCreateSchema>;
export type ProgramUpdateInput = z.infer<typeof programUpdateSchema>;
export type SectionCreateInput = z.infer<typeof sectionCreateSchema>;
export type SectionUpdateInput = z.infer<typeof sectionUpdateSchema>;
export type StaffUserCreateInput = z.infer<typeof staffUserCreateSchema>;
export type StaffUserUpdateInput = z.infer<typeof staffUserUpdateSchema>;
export type StudentAccountUpdateInput = z.infer<typeof studentAccountUpdateSchema>;
