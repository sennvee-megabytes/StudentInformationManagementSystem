import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import {
  AcademicRecordCreateInput,
  AcademicRecordUpdateInput,
  EnrollmentUpsertInput,
  StudentCreateInput,
  StudentListQuery,
  StudentUpdateInput,
} from "@/validation/student";

type Actor = {
  user: { id: string; role: Role };
};

const SORTABLE: Record<string, Prisma.StudentOrderByWithRelationInput[]> = {
  "lastName:asc": [{ lastName: "asc" }, { firstName: "asc" }],
  "lastName:desc": [{ lastName: "desc" }, { firstName: "desc" }],
  "studentNumber:asc": [{ studentNumber: "asc" }],
  "studentNumber:desc": [{ studentNumber: "desc" }],
  "createdAt:desc": [{ createdAt: "desc" }],
  "createdAt:asc": [{ createdAt: "asc" }],
};

async function validateProgramAndSection(opts: {
  programId: string;
  yearLevel: number;
  sectionId?: string | null;
  excludeStudentId?: string;
}) {
  const program = await prisma.program.findUnique({ where: { id: opts.programId } });
  if (!program || !program.isActive) {
    throw new HttpError(422, "INVALID_PROGRAM", "Selected program does not exist or is inactive.");
  }

  if (opts.sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: opts.sectionId },
    });
    if (!section || !section.isActive) {
      throw new HttpError(422, "INVALID_SECTION", "Selected section does not exist or is inactive.");
    }
    if (section.programId !== opts.programId || section.yearLevel !== opts.yearLevel) {
      throw new HttpError(
        422,
        "SECTION_MISMATCH",
        "Selected section does not belong to the chosen program and year level."
      );
    }

    if (section.capacity !== null) {
      const assignedCount = await prisma.student.count({
        where: {
          sectionId: section.id,
          deletedAt: null,
          ...(opts.excludeStudentId ? { id: { not: opts.excludeStudentId } } : {}),
        },
      });
      if (assignedCount >= section.capacity) {
        throw new HttpError(
          422,
          "SECTION_FULL",
          `Section ${section.name} is at full capacity (${section.capacity} students).`
        );
      }
    }
  }
}

export const studentService = {
  async list(actor: Actor, query: StudentListQuery) {
    const q = query.q?.trim();
    const allowDeleted = actor.user.role === "ADMIN" && query.includeDeleted;

    const where: Prisma.StudentWhereInput = {
      ...(allowDeleted ? {} : { deletedAt: null }),
      ...(q && {
        OR: [
          { studentNumber: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(query.programId && { programId: query.programId }),
      ...(query.yearLevel && { yearLevel: query.yearLevel }),
      ...(query.sectionId && { sectionId: query.sectionId }),
      ...(query.status && { enrollmentStatus: query.status }),
    };

    const orderBy = SORTABLE[query.sort] ?? SORTABLE["lastName:asc"];
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        include: {
          program: { select: { id: true, code: true, name: true } },
          section: { select: { id: true, name: true, yearLevel: true, schoolYear: true } },
          user: { select: { id: true, username: true, status: true } },
        },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  },

  async getById(actor: Actor, id: string) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        program: { select: { id: true, code: true, name: true } },
        section: { select: { id: true, name: true, yearLevel: true, schoolYear: true } },
        user: {
          select: {
            id: true,
            username: true,
            status: true,
            mustChangePassword: true,
            lastLoginAt: true,
          },
        },
        enrollments: {
          orderBy: [{ schoolYear: "desc" }, { semester: "desc" }],
          include: {
            program: { select: { id: true, code: true, name: true } },
            section: { select: { id: true, name: true, yearLevel: true } },
          },
        },
        academicRecords: {
          orderBy: [{ schoolYear: "desc" }, { semester: "desc" }, { subjectCode: "asc" }],
        },
      },
    });

    if (!student || (student.deletedAt !== null && actor.user.role !== "ADMIN")) {
      throw new HttpError(404, "NOT_FOUND", "Student record not found.");
    }

    return {
      ...student,
      academicRecords: student.academicRecords.map((r) => ({
        ...r,
        units: Number(r.units),
      })),
    };
  },

  async create(
    actor: Actor,
    input: StudentCreateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const studentNumber = input.studentNumber.trim();
    const username = studentNumber.toLowerCase();

    const [existingStudent, existingUser] = await Promise.all([
      prisma.student.findUnique({ where: { studentNumber } }),
      prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingStudent || existingUser) {
      throw new HttpError(
        409,
        "DUPLICATE_STUDENT_NUMBER",
        `Student number "${studentNumber}" is already registered.`,
        { studentNumber: [`Student number "${studentNumber}" is already registered.`] }
      );
    }

    await validateProgramAndSection({
      programId: input.programId,
      yearLevel: input.yearLevel,
      sectionId: input.sectionId ?? null,
    });

    const temporaryPassword = generateTemporaryPassword(12);
    const passwordHash = await hashPassword(temporaryPassword);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          role: "STUDENT",
          status: "ACTIVE",
          mustChangePassword: true,
          createdById: actor.user.id,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          studentNumber,
          firstName: input.firstName,
          middleName: input.middleName ?? null,
          lastName: input.lastName,
          suffix: input.suffix ?? null,
          sex: input.sex,
          birthDate: new Date(input.birthDate),
          contactNumber: input.contactNumber ?? null,
          address: input.address ?? null,
          personalEmail: input.personalEmail ?? null,
          guardianName: input.guardianName ?? null,
          guardianContact: input.guardianContact ?? null,
          programId: input.programId,
          yearLevel: input.yearLevel,
          sectionId: input.sectionId ?? null,
          enrollmentStatus: "ENROLLED",
          dateEnrolled: new Date(),
          createdById: actor.user.id,
          updatedById: actor.user.id,
        },
      });

      await tx.enrollment.create({
        data: {
          studentId: student.id,
          programId: input.programId,
          sectionId: input.sectionId ?? null,
          schoolYear: input.schoolYear,
          semester: input.semester,
          yearLevel: input.yearLevel,
          status: "ENROLLED",
          enrolledById: actor.user.id,
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "STUDENT_CREATED",
          entityType: "Student",
          entityId: student.id,
          metadata: {
            studentNumber: student.studentNumber,
            programId: student.programId,
            yearLevel: student.yearLevel,
            sectionId: student.sectionId,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "ACCOUNT_CREATED",
          entityType: "User",
          entityId: user.id,
          metadata: { username: user.username, role: "STUDENT", studentId: student.id },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return { student, user };
    });

    return {
      id: created.student.id,
      studentNumber: created.student.studentNumber,
      account: {
        username: created.user.username,
        temporaryPassword,
        shownOnce: true as const,
      },
    };
  },

  async update(
    actor: Actor,
    id: string,
    input: StudentUpdateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const current = await prisma.student.findUnique({ where: { id } });
    if (!current || current.deletedAt !== null) {
      throw new HttpError(404, "NOT_FOUND", "Student record not found.");
    }

    const nextProgramId = input.programId ?? current.programId;
    const nextYearLevel = input.yearLevel ?? current.yearLevel;
    const nextSectionId =
      input.sectionId !== undefined ? input.sectionId : current.sectionId;

    if (
      input.programId !== undefined ||
      input.yearLevel !== undefined ||
      input.sectionId !== undefined
    ) {
      await validateProgramAndSection({
        programId: nextProgramId,
        yearLevel: nextYearLevel,
        sectionId: nextSectionId,
        excludeStudentId: id,
      });
    }

    const { version, birthDate, ...rest } = input;
    const changedFields = Object.keys(rest).concat(birthDate ? ["birthDate"] : []);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.student.updateMany({
        where: { id, version, deletedAt: null },
        data: {
          ...rest,
          ...(birthDate !== undefined && { birthDate: new Date(birthDate) }),
          version: { increment: 1 },
          updatedById: actor.user.id,
        },
      });

      if (updated.count === 0) {
        throw new HttpError(
          409,
          "VERSION_CONFLICT",
          "This record was changed by someone else. Reload and try again."
        );
      }

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "STUDENT_UPDATED",
          entityType: "Student",
          entityId: id,
          metadata: { changedFields },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return tx.student.findUniqueOrThrow({
        where: { id },
        include: {
          program: { select: { id: true, code: true, name: true } },
          section: { select: { id: true, name: true, yearLevel: true, schoolYear: true } },
        },
      });
    });
  },

  async upsertEnrollment(
    actor: Actor,
    studentId: string,
    input: EnrollmentUpsertInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.deletedAt !== null) {
      throw new HttpError(404, "NOT_FOUND", "Student record not found.");
    }

    await validateProgramAndSection({
      programId: input.programId,
      yearLevel: input.yearLevel,
      sectionId: input.sectionId ?? null,
      excludeStudentId: studentId,
    });

    return prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.upsert({
        where: {
          studentId_schoolYear_semester: {
            studentId,
            schoolYear: input.schoolYear,
            semester: input.semester,
          },
        },
        create: {
          studentId,
          programId: input.programId,
          sectionId: input.sectionId ?? null,
          schoolYear: input.schoolYear,
          semester: input.semester,
          yearLevel: input.yearLevel,
          status: input.status,
          enrolledById: actor.user.id,
        },
        update: {
          programId: input.programId,
          sectionId: input.sectionId ?? null,
          yearLevel: input.yearLevel,
          status: input.status,
          enrolledById: actor.user.id,
        },
      });

      await tx.student.update({
        where: { id: studentId },
        data: {
          programId: input.programId,
          yearLevel: input.yearLevel,
          sectionId: input.sectionId ?? null,
          enrollmentStatus: input.status,
          ...(input.status === "ENROLLED" && !student.dateEnrolled
            ? { dateEnrolled: new Date() }
            : {}),
          version: { increment: 1 },
          updatedById: actor.user.id,
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "ENROLLMENT_RECORDED",
          entityType: "Enrollment",
          entityId: enrollment.id,
          metadata: {
            studentId,
            schoolYear: input.schoolYear,
            semester: input.semester,
            yearLevel: input.yearLevel,
            status: input.status,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return enrollment;
    });
  },

  async softDelete(actor: Actor, id: string, meta?: { ip?: string; userAgent?: string }) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student || student.deletedAt !== null) {
      throw new HttpError(404, "NOT_FOUND", "Student record not found.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedById: actor.user.id,
          version: { increment: 1 },
        },
      });

      if (student.userId) {
        await tx.user.update({
          where: { id: student.userId },
          data: { status: "INACTIVE" },
        });
        await tx.session.updateMany({
          where: { userId: student.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "STUDENT_SOFT_DELETED",
          entityType: "Student",
          entityId: id,
          metadata: { studentNumber: student.studentNumber },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return { id, deleted: true };
    });
  },

  async restore(actor: Actor, id: string, meta?: { ip?: string; userAgent?: string }) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student || student.deletedAt === null) {
      throw new HttpError(404, "NOT_FOUND", "Deleted student record not found.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          deletedAt: null,
          updatedById: actor.user.id,
          version: { increment: 1 },
        },
      });

      if (student.userId) {
        await tx.user.update({
          where: { id: student.userId },
          data: { status: "ACTIVE" },
        });
      }

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "STUDENT_RESTORED",
          entityType: "Student",
          entityId: id,
          metadata: { studentNumber: student.studentNumber },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return { id, restored: true };
    });
  },

  async addAcademicRecord(
    actor: Actor,
    studentId: string,
    input: AcademicRecordCreateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.deletedAt !== null) {
      throw new HttpError(404, "NOT_FOUND", "Student record not found.");
    }

    return prisma.$transaction(async (tx) => {
      const record = await tx.academicRecord.create({
        data: {
          studentId,
          schoolYear: input.schoolYear,
          semester: input.semester,
          subjectCode: input.subjectCode,
          subjectTitle: input.subjectTitle,
          units: input.units,
          grade: input.grade ?? null,
          remarks: input.remarks ?? null,
          encodedById: actor.user.id,
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "ACADEMIC_RECORD_ADDED",
          entityType: "AcademicRecord",
          entityId: record.id,
          metadata: {
            studentId,
            schoolYear: record.schoolYear,
            semester: record.semester,
            subjectCode: record.subjectCode,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return { ...record, units: Number(record.units) };
    });
  },

  async updateAcademicRecord(
    actor: Actor,
    studentId: string,
    recordId: string,
    input: AcademicRecordUpdateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const existing = await prisma.academicRecord.findFirst({
      where: { id: recordId, studentId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Academic subject record not found.");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.academicRecord.update({
        where: { id: recordId },
        data: {
          ...(input.subjectCode !== undefined && { subjectCode: input.subjectCode }),
          ...(input.subjectTitle !== undefined && { subjectTitle: input.subjectTitle }),
          ...(input.units !== undefined && { units: input.units }),
          ...(input.grade !== undefined && { grade: input.grade }),
          ...(input.remarks !== undefined && { remarks: input.remarks }),
          encodedById: actor.user.id,
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "ACADEMIC_RECORD_UPDATED",
          entityType: "AcademicRecord",
          entityId: recordId,
          metadata: {
            studentId,
            subjectCode: updated.subjectCode,
            changedFields: Object.keys(input),
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return { ...updated, units: Number(updated.units) };
    });
  },

  async deleteAcademicRecord(
    actor: Actor,
    studentId: string,
    recordId: string,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const existing = await prisma.academicRecord.findFirst({
      where: { id: recordId, studentId },
    });
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Academic subject record not found.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.academicRecord.delete({ where: { id: recordId } });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "ACADEMIC_RECORD_DELETED",
          entityType: "AcademicRecord",
          entityId: recordId,
          metadata: {
            studentId,
            subjectCode: existing.subjectCode,
            schoolYear: existing.schoolYear,
            semester: existing.semester,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return { id: recordId, deleted: true };
    });
  },
};
