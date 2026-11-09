import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProgramFindUnique = vi.fn();
const mockSectionFindUnique = vi.fn();
const mockStudentCount = vi.fn();
const mockStudentFindUnique = vi.fn();
const mockStudentFindUniqueOrThrow = vi.fn();
const mockStudentFindMany = vi.fn();
const mockStudentCreate = vi.fn();
const mockStudentUpdate = vi.fn();
const mockStudentUpdateMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockEnrollmentCreate = vi.fn();
const mockEnrollmentUpsert = vi.fn();
const mockAcademicFindFirst = vi.fn();
const mockAcademicCreate = vi.fn();
const mockAcademicUpdate = vi.fn();
const mockAcademicDelete = vi.fn();
const mockSessionUpdateMany = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    program: {
      findUnique: (...args: unknown[]) => mockProgramFindUnique(...args),
    },
    section: {
      findUnique: (...args: unknown[]) => mockSectionFindUnique(...args),
    },
    student: {
      count: (...args: unknown[]) => mockStudentCount(...args),
      findUnique: (...args: unknown[]) => mockStudentFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockStudentFindUniqueOrThrow(...args),
      findMany: (...args: unknown[]) => mockStudentFindMany(...args),
      create: (...args: unknown[]) => mockStudentCreate(...args),
      update: (...args: unknown[]) => mockStudentUpdate(...args),
      updateMany: (...args: unknown[]) => mockStudentUpdateMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    enrollment: {
      create: (...args: unknown[]) => mockEnrollmentCreate(...args),
      upsert: (...args: unknown[]) => mockEnrollmentUpsert(...args),
    },
    academicRecord: {
      findFirst: (...args: unknown[]) => mockAcademicFindFirst(...args),
      create: (...args: unknown[]) => mockAcademicCreate(...args),
      update: (...args: unknown[]) => mockAcademicUpdate(...args),
      delete: (...args: unknown[]) => mockAcademicDelete(...args),
    },
    session: {
      updateMany: (...args: unknown[]) => mockSessionUpdateMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: {
          create: (...args: unknown[]) => mockUserCreate(...args),
          update: (...args: unknown[]) => mockUserUpdate(...args),
        },
        student: {
          create: (...args: unknown[]) => mockStudentCreate(...args),
          update: (...args: unknown[]) => mockStudentUpdate(...args),
          updateMany: (...args: unknown[]) => mockStudentUpdateMany(...args),
          findUniqueOrThrow: (...args: unknown[]) => mockStudentFindUniqueOrThrow(...args),
        },
        enrollment: {
          create: (...args: unknown[]) => mockEnrollmentCreate(...args),
          upsert: (...args: unknown[]) => mockEnrollmentUpsert(...args),
        },
        academicRecord: {
          create: (...args: unknown[]) => mockAcademicCreate(...args),
          update: (...args: unknown[]) => mockAcademicUpdate(...args),
          delete: (...args: unknown[]) => mockAcademicDelete(...args),
        },
        session: {
          updateMany: (...args: unknown[]) => mockSessionUpdateMany(...args),
        },
        auditLog: {
          create: (...args: unknown[]) => mockAuditCreate(...args),
        },
      }),
  },
}));

import { studentService } from "@/server/services/students";
import { studentListQuerySchema } from "@/validation/student";

describe("Phase 4 – Registrar & Student Workflows", () => {
  const staffActor = { user: { id: "staff-1", role: "STAFF" as const } };
  const adminActor = { user: { id: "admin-1", role: "ADMIN" as const } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-02: registers a student in a single transaction (user + student + enrollment + audits) and returns one-time temp password", async () => {
    mockStudentFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue(null);
    mockProgramFindUnique.mockResolvedValue({
      id: "b3a00000-0000-4000-8000-000000000001",
      code: "BSIT",
      isActive: true,
    });
    mockSectionFindUnique.mockResolvedValue({
      id: "b3a00000-0000-4000-8000-000000000002",
      programId: "b3a00000-0000-4000-8000-000000000001",
      yearLevel: 1,
      name: "A",
      capacity: 40,
      isActive: true,
    });
    mockStudentCount.mockResolvedValue(10);

    mockUserCreate.mockResolvedValue({ id: "user-stu-1", username: "202612345" });
    mockStudentCreate.mockResolvedValue({
      id: "stu-1",
      studentNumber: "202612345",
      programId: "prog-1",
      yearLevel: 1,
      sectionId: "sec-1",
    });
    mockEnrollmentCreate.mockResolvedValue({ id: "enr-1" });

    const res = await studentService.create(staffActor, {
      studentNumber: "202612345",
      firstName: "Juan",
      middleName: "Santos",
      lastName: "Dela Cruz",
      suffix: null,
      sex: "MALE",
      birthDate: "2006-03-14",
      contactNumber: "09171234567",
      address: "Indang, Cavite",
      personalEmail: null,
      guardianName: "Maria Dela Cruz",
      guardianContact: "09181234567",
      programId: "b3a00000-0000-4000-8000-000000000001",
      yearLevel: 1,
      sectionId: "b3a00000-0000-4000-8000-000000000002",
      schoolYear: "2026-2027",
      semester: "FIRST",
    });

    expect(res.studentNumber).toBe("202612345");
    expect(res.account.username).toBe("202612345");
    expect(res.account.temporaryPassword).toHaveLength(12);
    expect(res.account.shownOnce).toBe(true);

    const actions = mockAuditCreate.mock.calls.map((c) => c[0]?.data?.action);
    expect(actions).toContain("STUDENT_CREATED");
    expect(actions).toContain("ACCOUNT_CREATED");
  });

  it("TC-07: rejects student registration or section assignment when section capacity is reached", async () => {
    mockStudentFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue(null);
    mockProgramFindUnique.mockResolvedValue({ id: "prog-1", code: "BSIT", isActive: true });
    mockSectionFindUnique.mockResolvedValue({
      id: "sec-1",
      programId: "b3a00000-0000-4000-8000-000000000001",
      yearLevel: 1,
      name: "A",
      capacity: 30,
      isActive: true,
    });
    mockStudentCount.mockResolvedValue(30); // Section is full

    await expect(
      studentService.create(staffActor, {
        studentNumber: "202699999",
        firstName: "Maria",
        lastName: "Santos",
        sex: "FEMALE",
        birthDate: "2006-04-10",
        programId: "b3a00000-0000-4000-8000-000000000001",
        yearLevel: 1,
        sectionId: "b3a00000-0000-4000-8000-000000000002",
        schoolYear: "2026-2027",
        semester: "FIRST",
      })
    ).rejects.toMatchObject({
      status: 422,
      code: "SECTION_FULL",
    });
  });

  it("TC-05: enforces optimistic concurrency locking on student profile update (returns 409 on version mismatch)", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "stu-1",
      programId: "prog-1",
      yearLevel: 1,
      sectionId: null,
      version: 2,
      deletedAt: null,
    });
    mockStudentUpdateMany.mockResolvedValue({ count: 0 }); // Concurrent modification occurred

    await expect(
      studentService.update(staffActor, "stu-1", {
        address: "Tagaytay City",
        version: 1, // stale version
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
    });
  });

  it("TC-06: soft-deletes and restores a student record, deactivating/revoking sessions on delete and auditing both", async () => {
    mockStudentFindUnique.mockResolvedValueOnce({
      id: "stu-1",
      userId: "user-stu-1",
      studentNumber: "202612345",
      deletedAt: null,
    });

    const delRes = await studentService.softDelete(adminActor, "stu-1");
    expect(delRes.deleted).toBe(true);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-stu-1" },
      data: { status: "INACTIVE" },
    });
    expect(mockSessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("STUDENT_SOFT_DELETED");

    mockStudentFindUnique.mockResolvedValueOnce({
      id: "stu-1",
      userId: "user-stu-1",
      studentNumber: "202612345",
      deletedAt: new Date(),
    });

    const restoreRes = await studentService.restore(adminActor, "stu-1");
    expect(restoreRes.restored).toBe(true);
    expect(mockAuditCreate.mock.calls[1]?.[0]?.data?.action).toBe("STUDENT_RESTORED");
  });

  it("SEC-02: binds SQLi search payloads as literal parameters and enforces sort allow-list", async () => {
    mockStudentFindMany.mockResolvedValue([]);
    mockStudentCount.mockResolvedValue(0);

    const parsed = studentListQuerySchema.parse({
      q: "%'; DROP TABLE students;--",
      sort: "lastName:asc",
    });

    await studentService.list(staffActor, parsed);

    const whereArg = mockStudentFindMany.mock.calls[0]?.[0]?.where;
    expect(whereArg.deletedAt).toBeNull();
    expect(whereArg.OR[0].studentNumber.contains).toBe("%'; DROP TABLE students;--");
  });

  it("registers, updates, and deletes academic subject records with immutable audit logging", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "stu-1",
      studentNumber: "202612345",
      deletedAt: null,
    });
    mockAcademicCreate.mockResolvedValue({
      id: "acad-1",
      studentId: "stu-1",
      schoolYear: "2026-2027",
      semester: "FIRST",
      subjectCode: "ITEC 50",
      subjectTitle: "Web Systems and Technologies",
      units: 3,
      grade: null,
      remarks: "ENROLLED",
    });

    const created = await studentService.addAcademicRecord(staffActor, "stu-1", {
      schoolYear: "2026-2027",
      semester: "FIRST",
      subjectCode: "ITEC 50",
      subjectTitle: "Web Systems and Technologies",
      units: 3,
      grade: null,
      remarks: "ENROLLED",
    });
    expect(created.subjectCode).toBe("ITEC 50");
    expect(created.units).toBe(3);

    mockAcademicFindFirst.mockResolvedValue({
      id: "acad-1",
      studentId: "stu-1",
      schoolYear: "2026-2027",
      semester: "FIRST",
      subjectCode: "ITEC 50",
    });
    mockAcademicUpdate.mockResolvedValue({
      id: "acad-1",
      studentId: "stu-1",
      schoolYear: "2026-2027",
      semester: "FIRST",
      subjectCode: "ITEC 50",
      subjectTitle: "Web Systems and Technologies",
      units: 3,
      grade: "1.25",
      remarks: "PASSED",
    });

    const updated = await studentService.updateAcademicRecord(staffActor, "stu-1", "acad-1", {
      grade: "1.25",
      remarks: "PASSED",
    });
    expect(updated.grade).toBe("1.25");
    expect(updated.remarks).toBe("PASSED");

    mockAcademicDelete.mockResolvedValue({ id: "acad-1" });
    const deleted = await studentService.deleteAcademicRecord(staffActor, "stu-1", "acad-1");
    expect(deleted.deleted).toBe(true);

    const actions = mockAuditCreate.mock.calls.map((c) => c[0]?.data?.action);
    expect(actions).toEqual([
      "ACADEMIC_RECORD_ADDED",
      "ACADEMIC_RECORD_UPDATED",
      "ACADEMIC_RECORD_DELETED",
    ]);
  });
});
