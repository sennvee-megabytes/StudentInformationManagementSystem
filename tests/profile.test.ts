import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mockStudentFindFirst = vi.fn();
const mockStudentUpdate = vi.fn();
const mockEnrollmentFindMany = vi.fn();
const mockAcademicFindMany = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: (...args: unknown[]) => mockStudentFindFirst(...args),
      update: (...args: unknown[]) => mockStudentUpdate(...args),
    },
    enrollment: {
      findMany: (...args: unknown[]) => mockEnrollmentFindMany(...args),
    },
    academicRecord: {
      findMany: (...args: unknown[]) => mockAcademicFindMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        student: {
          update: (...args: unknown[]) => mockStudentUpdate(...args),
        },
        auditLog: {
          create: (...args: unknown[]) => mockAuditCreate(...args),
        },
      }),
  },
}));

import { profileService } from "@/server/services/profile";

describe("Phase 5 – Student Self-Service Portal & IDOR / Mass-Assignment Defense", () => {
  const studentActor = { user: { id: "user-stu-1", role: "STUDENT" as const } };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FEATURE_ACADEMIC_RECORDS = "true";
  });

  it("TC-03 / SEC-03: resolves student profile strictly from session.user.id (never from a caller-supplied ID)", async () => {
    mockStudentFindFirst.mockResolvedValue({
      id: "stu-1",
      userId: "user-stu-1",
      studentNumber: "202612345",
      firstName: "Juan",
      lastName: "Dela Cruz",
      program: { id: "prog-1", code: "BSIT", name: "BS Information Technology" },
      section: null,
    });

    const profile = await profileService.getOwnProfile(studentActor);
    expect(profile.studentNumber).toBe("202612345");
    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-stu-1", deletedAt: null },
      })
    );
  });

  it("TC-04 / SEC-05: updates only permitted self-service contact fields, logs STUDENT_SELF_UPDATED, and rejects protected fields", async () => {
    mockStudentFindFirst.mockResolvedValue({
      id: "stu-1",
      userId: "user-stu-1",
      studentNumber: "202612345",
    });
    mockStudentUpdate.mockResolvedValue({
      id: "stu-1",
      address: "Tagaytay City, Cavite",
      contactNumber: "09179998888",
    });

    const updated = await profileService.updateOwnProfile(studentActor, {
      address: "Tagaytay City, Cavite",
      contactNumber: "09179998888",
    });

    expect(updated.address).toBe("Tagaytay City, Cavite");
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("STUDENT_SELF_UPDATED");
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.metadata).toEqual({
      changedFields: ["contactNumber", "address"],
    });

    // Attempting to inject a protected field (e.g., yearLevel or programId) throws ZodError (422)
    await expect(
      profileService.updateOwnProfile(studentActor, {
        address: "Indang",
        // @ts-expect-error testing runtime mass-assignment protection
        yearLevel: 4,
      })
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("A3: respects FEATURE_ACADEMIC_RECORDS flag on academic records lookup", async () => {
    process.env.FEATURE_ACADEMIC_RECORDS = "false";
    await expect(profileService.getOwnAcademicRecords(studentActor)).rejects.toMatchObject({
      status: 404,
      code: "FEATURE_DISABLED",
    });
  });
});
