import { z } from "zod";
import { schoolYearSchema } from "@/validation/admin";

const nameRegex = /^[\p{L}\s'.-]+$/u;

export const selfUpdateSchema = z
  .object({
    contactNumber: z
      .string()
      .regex(/^(09|\+639)\d{9}$/, "Use a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)")
      .nullable(),
    address: z.string().max(255).nullable(),
    personalEmail: z.string().email().max(254).nullable(),
    guardianName: z.string().max(120).nullable(),
    guardianContact: z
      .string()
      .regex(/^(09|\+639)\d{9}$/, "Use a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)")
      .nullable(),
  })
  .partial()
  .strict(); // brief A5: only five fields, anything else = 422

export const studentCreateSchema = z
  .object({
    studentNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{6,20}$/, "Student number must be 6–20 alphanumeric/hyphen characters"),
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(60)
      .regex(nameRegex, "First name contains invalid characters."),
    middleName: z
      .string()
      .trim()
      .max(60)
      .regex(nameRegex, "Middle name contains invalid characters.")
      .nullable()
      .optional(),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required.")
      .max(60)
      .regex(nameRegex, "Last name contains invalid characters."),
    suffix: z.string().trim().max(20).nullable().optional(),
    sex: z.enum(["MALE", "FEMALE"]),
    birthDate: z
      .string()
      .date("Birth date must be a valid YYYY-MM-DD date.")
      .refine((d) => new Date(d) < new Date(), "Birth date must be in the past."),
    contactNumber: z
      .string()
      .regex(/^(09|\+639)\d{9}$/, "Use a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)")
      .nullable()
      .optional(),
    address: z.string().trim().max(255).nullable().optional(),
    personalEmail: z.string().trim().email().max(254).nullable().optional(),
    guardianName: z.string().trim().max(120).nullable().optional(),
    guardianContact: z
      .string()
      .regex(/^(09|\+639)\d{9}$/, "Use a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)")
      .nullable()
      .optional(),
    programId: z.string().uuid("Select a valid program."),
    yearLevel: z.number().int().min(1).max(6),
    sectionId: z.string().uuid().nullable().optional(),
    schoolYear: schoolYearSchema,
    semester: z.enum(["FIRST", "SECOND", "MIDYEAR"]),
    subjects: z
      .array(
        z
          .object({
            subjectCode: z
              .string()
              .trim()
              .min(2)
              .max(24)
              .regex(/^[A-Za-z0-9\s-]+$/)
              .transform((v) => v.toUpperCase()),
            subjectTitle: z.string().trim().min(2).max(120),
            units: z.number().min(0).max(12),
          })
          .strict()
      )
      .max(20)
      .optional(),
  })
  .strict();

export const studentUpdateSchema = studentCreateSchema
  .omit({ studentNumber: true, schoolYear: true, semester: true, subjects: true })
  .partial()
  .extend({
    enrollmentStatus: z
      .enum(["ENROLLED", "NOT_ENROLLED", "ON_LEAVE", "GRADUATED", "DROPPED"])
      .optional(),
    version: z.number().int().min(1),
  })
  .strict();

export const enrollmentUpsertSchema = z
  .object({
    programId: z.string().uuid("Select a valid program."),
    yearLevel: z.number().int().min(1).max(6),
    sectionId: z.string().uuid().nullable().optional(),
    schoolYear: schoolYearSchema,
    semester: z.enum(["FIRST", "SECOND", "MIDYEAR"]),
    status: z
      .enum(["ENROLLED", "NOT_ENROLLED", "ON_LEAVE", "GRADUATED", "DROPPED"])
      .default("ENROLLED"),
  })
  .strict();

export const academicRecordCreateSchema = z
  .object({
    schoolYear: schoolYearSchema,
    semester: z.enum(["FIRST", "SECOND", "MIDYEAR"]),
    subjectCode: z
      .string()
      .trim()
      .min(2, "Subject code is required (e.g. ITEC 50).")
      .max(24)
      .regex(/^[A-Za-z0-9\s-]+$/, "Subject code may only contain letters, numbers, spaces, and hyphens.")
      .transform((v) => v.toUpperCase()),
    subjectTitle: z.string().trim().min(2, "Descriptive title is required.").max(120),
    units: z.number().min(0, "Units cannot be negative.").max(12, "Units cannot exceed 12."),
    grade: z.string().trim().max(16).nullable().optional(),
    remarks: z.string().trim().max(60).nullable().optional(),
  })
  .strict();

export const academicRecordUpdateSchema = z
  .object({
    subjectCode: z
      .string()
      .trim()
      .min(2)
      .max(24)
      .regex(/^[A-Za-z0-9\s-]+$/)
      .transform((v) => v.toUpperCase())
      .optional(),
    subjectTitle: z.string().trim().min(2).max(120).optional(),
    units: z.number().min(0).max(12).optional(),
    grade: z.string().trim().max(16).nullable().optional(),
    remarks: z.string().trim().max(60).nullable().optional(),
  })
  .strict();

export const studentListQuerySchema = z.object({
  q: z.string().trim().max(64).optional(),
  programId: z.string().uuid().optional(),
  yearLevel: z.coerce.number().int().min(1).max(6).optional(),
  sectionId: z.string().uuid().optional(),
  status: z.enum(["ENROLLED", "NOT_ENROLLED", "ON_LEAVE", "GRADUATED", "DROPPED"]).optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum([
      "lastName:asc",
      "lastName:desc",
      "studentNumber:asc",
      "studentNumber:desc",
      "createdAt:desc",
      "createdAt:asc",
    ])
    .default("lastName:asc"),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type EnrollmentUpsertInput = z.infer<typeof enrollmentUpsertSchema>;
export type AcademicRecordCreateInput = z.infer<typeof academicRecordCreateSchema>;
export type AcademicRecordUpdateInput = z.infer<typeof academicRecordUpdateSchema>;
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
