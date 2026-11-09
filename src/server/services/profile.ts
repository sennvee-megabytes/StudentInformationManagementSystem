import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import { selfUpdateSchema } from "@/validation/student";
import { z } from "zod";

type Actor = {
  user: { id: string; role: Role };
};

export type SelfUpdateInput = z.infer<typeof selfUpdateSchema>;

export function isAcademicRecordsEnabled(): boolean {
  return process.env.FEATURE_ACADEMIC_RECORDS !== "false";
}

export const profileService = {
  async getOwnProfile(actor: Actor) {
    const student = await prisma.student.findFirst({
      where: {
        userId: actor.user.id,
        deletedAt: null,
      },
      include: {
        program: { select: { id: true, code: true, name: true, description: true } },
        section: { select: { id: true, name: true, yearLevel: true, schoolYear: true } },
      },
    });

    if (!student) {
      throw new HttpError(404, "PROFILE_NOT_FOUND", "Student profile not found for this account.");
    }

    return student;
  },

  async updateOwnProfile(
    actor: Actor,
    input: SelfUpdateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const parsed = selfUpdateSchema.parse(input);
    const student = await prisma.student.findFirst({
      where: { userId: actor.user.id, deletedAt: null },
    });

    if (!student) {
      throw new HttpError(404, "PROFILE_NOT_FOUND", "Student profile not found for this account.");
    }

    const changedFields = Object.keys(parsed);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id: student.id },
        data: {
          ...(parsed.contactNumber !== undefined && { contactNumber: parsed.contactNumber }),
          ...(parsed.address !== undefined && { address: parsed.address }),
          ...(parsed.personalEmail !== undefined && { personalEmail: parsed.personalEmail }),
          ...(parsed.guardianName !== undefined && { guardianName: parsed.guardianName }),
          ...(parsed.guardianContact !== undefined && { guardianContact: parsed.guardianContact }),
          updatedById: actor.user.id,
        },
        include: {
          program: { select: { id: true, code: true, name: true, description: true } },
          section: { select: { id: true, name: true, yearLevel: true, schoolYear: true } },
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "STUDENT_SELF_UPDATED",
          entityType: "Student",
          entityId: student.id,
          metadata: { changedFields },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return updated;
    });
  },

  async getOwnEnrollments(actor: Actor) {
    const student = await prisma.student.findFirst({
      where: { userId: actor.user.id, deletedAt: null },
      select: { id: true, studentNumber: true, enrollmentStatus: true, dateEnrolled: true },
    });

    if (!student) {
      throw new HttpError(404, "PROFILE_NOT_FOUND", "Student profile not found for this account.");
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id },
      orderBy: [{ schoolYear: "desc" }, { semester: "desc" }],
      include: {
        program: { select: { id: true, code: true, name: true } },
        section: { select: { id: true, name: true, yearLevel: true, schoolYear: true } },
      },
    });

    return {
      student,
      enrollments,
    };
  },

  async getOwnAcademicRecords(actor: Actor) {
    if (!isAcademicRecordsEnabled()) {
      throw new HttpError(404, "FEATURE_DISABLED", "Academic records module is disabled.");
    }

    const student = await prisma.student.findFirst({
      where: { userId: actor.user.id, deletedAt: null },
      select: { id: true, studentNumber: true },
    });

    if (!student) {
      throw new HttpError(404, "PROFILE_NOT_FOUND", "Student profile not found for this account.");
    }

    const records = await prisma.academicRecord.findMany({
      where: { studentId: student.id },
      orderBy: [{ schoolYear: "desc" }, { semester: "desc" }, { subjectCode: "asc" }],
    });

    return records;
  },
};
