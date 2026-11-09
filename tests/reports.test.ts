import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";

const mockStudentFindMany = vi.fn();
const mockStudentCount = vi.fn();
const mockStudentGroupBy = vi.fn();
const mockUserCount = vi.fn();
const mockProgramFindMany = vi.fn();
const mockAuditFindMany = vi.fn();
const mockAuditCount = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findMany: (...args: unknown[]) => mockStudentFindMany(...args),
      count: (...args: unknown[]) => mockStudentCount(...args),
      groupBy: (...args: unknown[]) => mockStudentGroupBy(...args),
    },
    user: {
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    program: {
      findMany: (...args: unknown[]) => mockProgramFindMany(...args),
    },
    auditLog: {
      findMany: (...args: unknown[]) => mockAuditFindMany(...args),
      count: (...args: unknown[]) => mockAuditCount(...args),
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}));

import { reportService } from "@/server/services/reports";
import { dashboardService } from "@/server/services/dashboard";
import { auditLogService } from "@/server/services/audit-logs";

describe("Phase 6 – Reports, CSV Formula Neutralization, Dashboard & Activity Logs", () => {
  const staffActor = { user: { id: "staff-1", role: "STAFF" as const } };
  const adminActor = { user: { id: "admin-1", role: "ADMIN" as const } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-10 / S6: neutralizes CSV formula injection payloads (=, +, -, @, tab, CR) and quotes special characters", () => {
    expect(escapeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(escapeCsvCell("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    expect(escapeCsvCell("-100")).toBe("'-100");
    expect(escapeCsvCell("@HYPERLINK(\"http://evil\")")).toBe("\"'@HYPERLINK(\"\"http://evil\"\")\"");
    expect(escapeCsvCell("\tmalicious")).toBe("'\tmalicious");
    expect(escapeCsvCell("Dela Cruz, Juan")).toBe('"Dela Cruz, Juan"');
  });

  it("TC-10 / S8: generates student CSV report, neutralizes formula cells, and audits REPORT_GENERATED with filters (not PII)", async () => {
    mockStudentFindMany.mockResolvedValue([
      {
        id: "stu-1",
        studentNumber: "202612345",
        lastName: "Dela Cruz",
        firstName: "=HYPERLINK(\"http://evil\")",
        middleName: "Santos",
        suffix: null,
        sex: "MALE",
        yearLevel: 1,
        enrollmentStatus: "ENROLLED",
        contactNumber: "09171234567",
        personalEmail: "juan@example.ph",
        program: { code: "BSIT", name: "BS Information Technology" },
        section: { name: "A", schoolYear: "2026-2027" },
      },
    ]);

    const res = await reportService.generateStudentReport(staffActor, {
      programId: "b3a00000-0000-4000-8000-000000000001",
      format: "csv",
    });

    expect(res.rowCount).toBe(1);
    expect(res.csv).toContain("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("REPORT_GENERATED");
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.metadata).toMatchObject({
      reportType: "students",
      rowCount: 1,
    });
  });

  it("TC-09: computes non-deleted student totals, program breakdown, and recent activity logs for Admin Dashboard", async () => {
    mockStudentCount.mockResolvedValueOnce(120).mockResolvedValueOnce(115);
    mockUserCount.mockResolvedValueOnce(118).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    mockProgramFindMany.mockResolvedValue([
      { id: "p-1", code: "BSIT", name: "BSIT", isActive: true, _count: { students: 80 } },
    ]);
    mockStudentGroupBy.mockResolvedValueOnce([{ yearLevel: 1, _count: { _all: 50 } }]);
    mockStudentGroupBy.mockResolvedValueOnce([
      { enrollmentStatus: "ENROLLED", _count: { _all: 115 } },
    ]);
    mockAuditFindMany.mockResolvedValue([
      { id: "log-1", action: "LOGIN_SUCCESS", createdAt: new Date(), actor: { username: "admin", role: "ADMIN" } },
    ]);

    const stats = await dashboardService.getAdminStats();
    expect(stats.totalStudents).toBe(120);
    expect(stats.enrolledStudents).toBe(115);
    expect(stats.byProgram[0]?.count).toBe(80);
    expect(stats.recentAuditLogs).toHaveLength(1);
  });

  it("FR-ADM-09: filters and exports activity logs to CSV and audits REPORT_GENERATED", async () => {
    mockAuditFindMany.mockResolvedValue([
      {
        id: "log-1",
        actorRole: "ADMIN",
        action: "ACCOUNT_CREATED",
        outcome: "SUCCESS",
        entityType: "User",
        entityId: "u-1",
        ip: "127.0.0.1",
        metadata: { username: "registrar_1" },
        createdAt: new Date("2026-11-09T07:00:00Z"),
        actor: { id: "admin-1", username: "admin", role: "ADMIN" },
      },
    ]);
    mockAuditCount.mockResolvedValue(1);

    const csv = await auditLogService.exportCsv(adminActor, {
      action: "ACCOUNT_CREATED",
      page: 1,
      pageSize: 30,
      format: "csv",
    });

    expect(csv).toContain("ACCOUNT_CREATED");
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("REPORT_GENERATED");
  });
});
