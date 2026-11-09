import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";

type Actor = {
  user: { id: string; role: Role };
};

export const reportQuerySchema = z.object({
  programId: z.string().uuid().optional(),
  yearLevel: z.coerce.number().int().min(1).max(6).optional(),
  sectionId: z.string().uuid().optional(),
  status: z.enum(["ENROLLED", "NOT_ENROLLED", "ON_LEAVE", "GRADUATED", "DROPPED"]).optional(),
  format: z.enum(["csv", "json"]).default("csv"),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const MAX_EXPORT_ROWS = 5000;

export const reportService = {
  async generateStudentReport(
    actor: Actor,
    query: ReportQuery,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...(query.programId && { programId: query.programId }),
      ...(query.yearLevel && { yearLevel: query.yearLevel }),
      ...(query.sectionId && { sectionId: query.sectionId }),
      ...(query.status && { enrollmentStatus: query.status }),
    };

    const students = await prisma.student.findMany({
      where,
      orderBy: [{ program: { code: "asc" } }, { yearLevel: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      take: MAX_EXPORT_ROWS,
      include: {
        program: { select: { code: true, name: true } },
        section: { select: { name: true, schoolYear: true } },
      },
    });

    await audit({
      actorId: actor.user.id,
      actorRole: actor.user.role,
      action: "REPORT_GENERATED",
      entityType: "Report",
      metadata: {
        reportType: "students",
        format: query.format,
        filters: {
          programId: query.programId ?? null,
          yearLevel: query.yearLevel ?? null,
          sectionId: query.sectionId ?? null,
          status: query.status ?? null,
        },
        rowCount: students.length,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const headers = [
      "Student Number",
      "Last Name",
      "First Name",
      "Middle Name",
      "Suffix",
      "Sex",
      "Program Code",
      "Program Name",
      "Year Level",
      "Section",
      "Enrollment Status",
      "Contact Number",
      "Personal Email",
    ];

    const rows = students.map((s) => [
      s.studentNumber,
      s.lastName,
      s.firstName,
      s.middleName ?? "",
      s.suffix ?? "",
      s.sex,
      s.program.code,
      s.program.name,
      s.yearLevel,
      s.section ? `${s.program.code} ${s.yearLevel}-${s.section.name}` : "Unassigned",
      s.enrollmentStatus,
      s.contactNumber ?? "",
      s.personalEmail ?? "",
    ]);

    return {
      students,
      csv: toCsv(headers, rows),
      rowCount: students.length,
    };
  },
};
