import { prisma } from "@/lib/db";

export const dashboardService = {
  async getAdminStats() {
    const [
      totalStudents,
      enrolledStudents,
      activeAccounts,
      inactiveAccounts,
      lockedAccounts,
      programsWithCounts,
      byYearLevel,
      byStatus,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null, enrollmentStatus: "ENROLLED" } }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "INACTIVE" } }),
      prisma.user.count({
        where: {
          OR: [{ status: "LOCKED" }, { lockedUntil: { gt: new Date() } }],
        },
      }),
      prisma.program.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          _count: {
            select: {
              students: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.student.groupBy({
        by: ["yearLevel"],
        where: { deletedAt: null },
        _count: { _all: true },
        orderBy: { yearLevel: "asc" },
      }),
      prisma.student.groupBy({
        by: ["enrollmentStatus"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          actor: { select: { username: true, role: true } },
        },
      }),
    ]);

    return {
      totalStudents,
      enrolledStudents,
      activeAccounts,
      inactiveAccounts,
      lockedAccounts,
      byProgram: programsWithCounts.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        isActive: p.isActive,
        count: p._count.students,
      })),
      byYearLevel: byYearLevel.map((y) => ({
        yearLevel: y.yearLevel,
        count: y._count._all,
      })),
      byStatus: byStatus.map((s) => ({
        status: s.enrollmentStatus,
        count: s._count._all,
      })),
      recentAuditLogs,
    };
  },
};
