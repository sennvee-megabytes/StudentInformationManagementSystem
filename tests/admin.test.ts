import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserCount = vi.fn();
const mockSessionUpdateMany = vi.fn();
const mockSectionFindUnique = vi.fn();
const mockSectionUpdate = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    session: {
      updateMany: (...args: unknown[]) => mockSessionUpdateMany(...args),
    },
    section: {
      findUnique: (...args: unknown[]) => mockSectionFindUnique(...args),
      update: (...args: unknown[]) => mockSectionUpdate(...args),
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
        session: {
          updateMany: (...args: unknown[]) => mockSessionUpdateMany(...args),
        },
        section: {
          update: (...args: unknown[]) => mockSectionUpdate(...args),
        },
        auditLog: {
          create: (...args: unknown[]) => mockAuditCreate(...args),
        },
      }),
  },
}));

import { accountService } from "@/server/services/accounts";
import { sectionService } from "@/server/services/sections";
import { programCreateSchema, sectionCreateSchema } from "@/validation/admin";

describe("Phase 3 – Admin Data Setup & Account Guards", () => {
  const adminActor = { user: { id: "admin-1", role: "ADMIN" as const } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01: creates a staff account with mustChangePassword = true, returns one-time temp password, and audits ACCOUNT_CREATED", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "staff-1",
      username: data.username,
      email: data.email,
      role: data.role,
      status: data.status,
      mustChangePassword: data.mustChangePassword,
    }));

    const res = await accountService.createStaffOrAdmin(adminActor, {
      username: "registrar_ana",
      email: "ana@cvsu.edu.ph",
      role: "STAFF",
    });

    expect(res.shownOnce).toBe(true);
    expect(res.temporaryPassword).toHaveLength(12);
    expect(res.user.mustChangePassword).toBe(true);
    expect(res.user.role).toBe("STAFF");
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("ACCOUNT_CREATED");
  });

  it("SEC-13: prevents an administrator from demoting or deactivating their own account", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "admin-1",
      username: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    });

    await expect(
      accountService.updateStaffOrAdmin(adminActor, "admin-1", { role: "STAFF" })
    ).rejects.toMatchObject({
      status: 400,
      code: "SELF_DEMOTION_FORBIDDEN",
    });

    await expect(
      accountService.updateStaffOrAdmin(adminActor, "admin-1", { status: "INACTIVE" })
    ).rejects.toMatchObject({
      status: 400,
      code: "SELF_DEACTIVATION_FORBIDDEN",
    });
  });

  it("SEC-13: prevents demoting or deactivating the last remaining active administrator", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "admin-2",
      username: "second_admin",
      role: "ADMIN",
      status: "ACTIVE",
    });
    mockUserCount.mockResolvedValue(1); // Only 1 active admin left

    await expect(
      accountService.updateStaffOrAdmin(adminActor, "admin-2", { status: "INACTIVE" })
    ).rejects.toMatchObject({
      status: 400,
      code: "LAST_ADMIN_GUARD",
    });
  });

  it("TC-08 / S9: deactivating an account immediately revokes all active sessions and audits ACCOUNT_DEACTIVATED", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "staff-2",
      username: "registrar_bob",
      role: "STAFF",
      status: "ACTIVE",
    });
    mockUserUpdate.mockResolvedValue({
      id: "staff-2",
      username: "registrar_bob",
      role: "STAFF",
      status: "INACTIVE",
    });

    await accountService.updateStaffOrAdmin(adminActor, "staff-2", { status: "INACTIVE" });

    expect(mockSessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("ACCOUNT_DEACTIVATED");
  });

  it("validates school year range and prevents reducing section capacity below currently assigned students", async () => {
    expect(
      sectionCreateSchema.safeParse({
        programId: "b3a00000-0000-4000-8000-000000000000",
        yearLevel: 1,
        name: "A",
        schoolYear: "2026-2028", // invalid: 2028 !== 2026 + 1
        capacity: 40,
      }).success
    ).toBe(false);

    expect(
      programCreateSchema.safeParse({
        code: "bsit",
        name: "BS Information Technology",
      }).data?.code
    ).toBe("BSIT");

    mockSectionFindUnique.mockResolvedValue({
      id: "sec-1",
      programId: "prog-1",
      yearLevel: 1,
      name: "A",
      schoolYear: "2026-2027",
      capacity: 40,
      _count: { students: 25 },
    });

    await expect(
      sectionService.update(adminActor, "sec-1", { capacity: 20 })
    ).rejects.toMatchObject({
      status: 422,
      code: "CAPACITY_BELOW_ENROLLED",
    });
  });
});
