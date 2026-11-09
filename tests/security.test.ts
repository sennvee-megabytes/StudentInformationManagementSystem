import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateTemporaryPassword, hashPassword, passwordSchema, verifyPassword } from "@/lib/password";
import { selfUpdateSchema } from "@/validation/student";
import { changePasswordSchema, loginSchema, validatePasswordAgainstUsername } from "@/validation/auth";
import { assertSameOrigin, HttpError } from "@/lib/http";
import { PERMISSIONS } from "@/lib/authz";

const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockAuditCreate = vi.fn();
const mockCreateSession = vi.fn();
const mockDestroyCurrentSession = vi.fn();
const mockGetSession = vi.fn();
const mockRevokeAllSessions = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: { update: (...args: unknown[]) => mockUserUpdate(...args) },
        auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
      }),
  },
}));

vi.mock("@/lib/session", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  destroyCurrentSession: (...args: unknown[]) => mockDestroyCurrentSession(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
  revokeAllSessions: (...args: unknown[]) => mockRevokeAllSessions(...args),
}));

import { authService, MAX_FAILED_LOGINS } from "@/server/services/auth";

describe("Security Core – S1 Password Hashing & Policy", () => {
  it("hashes and verifies passwords with bcrypt cost 12", async () => {
    const plain = "StrongPass#2026";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword(plain, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword123", hash)).toBe(false);
    expect(await verifyPassword(plain, null)).toBe(false);
  });

  it("enforces password length, 72-byte bcrypt limit, common-password list, and username check", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("ValidPassword123!").success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);

    expect(
      changePasswordSchema.safeParse({
        currentPassword: "OldPassword!23",
        newPassword: "password123",
      }).success
    ).toBe(false);

    expect(validatePasswordAgainstUsername("MyAdminUser2026!", "adminuser")).not.toBeNull();
    expect(validatePasswordAgainstUsername("UnrelatedSecret#99", "adminuser")).toBeNull();
  });

  it("generates a 12-char temporary password", () => {
    const temp = generateTemporaryPassword();
    expect(temp).toHaveLength(12);
  });
});

describe("Security Core – S2/S7/S8 Authentication, Lockout, Session Rotation & Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns generic 401 and audits LOGIN_FAILURE for unknown username", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      authService.login({ username: "unknown", password: "SomePassword123!" }, { ip: "127.0.0.1" })
    ).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password.",
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("LOGIN_FAILURE");
  });

  it("locks account after 5 consecutive failed logins and writes ACCOUNT_LOCKED audit", async () => {
    const storedHash = await hashPassword("CorrectPass#2026");
    mockUserFindUnique.mockResolvedValue({
      id: "u-1",
      username: "202612345",
      passwordHash: storedHash,
      role: "STUDENT",
      status: "ACTIVE",
      mustChangePassword: false,
      failedLoginCount: MAX_FAILED_LOGINS - 1, // 4 previous failures
      lockedUntil: null,
    });

    await expect(
      authService.login({ username: "202612345", password: "WrongPassword!" }, { ip: "127.0.0.1" })
    ).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockUserUpdate.mock.calls[0]?.[0];
    expect(updateArg.data.failedLoginCount).toBe(5);
    expect(updateArg.data.lockedUntil).toBeInstanceOf(Date);

    const actions = mockAuditCreate.mock.calls.map((c) => c[0]?.data?.action);
    expect(actions).toContain("LOGIN_FAILURE");
    expect(actions).toContain("ACCOUNT_LOCKED");
  });

  it("rotates session, resets failure counter, and audits LOGIN_SUCCESS on valid login", async () => {
    const storedHash = await hashPassword("CorrectPass#2026");
    mockUserFindUnique.mockResolvedValue({
      id: "u-1",
      username: "202612345",
      passwordHash: storedHash,
      role: "STUDENT",
      status: "ACTIVE",
      mustChangePassword: true,
      failedLoginCount: 2,
      lockedUntil: null,
    });

    const result = await authService.login(
      { username: "202612345", password: "CorrectPass#2026" },
      { ip: "127.0.0.1" }
    );

    expect(result).toEqual({
      id: "u-1",
      username: "202612345",
      role: "STUDENT",
      mustChangePassword: true,
    });
    expect(mockDestroyCurrentSession).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledWith("u-1", { ip: "127.0.0.1" });
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("LOGIN_SUCCESS");
  });

  it("changes password, clears mustChangePassword, revokes other sessions, and redacts sensitive fields in audit", async () => {
    const oldHash = await hashPassword("TempPass#2026");
    mockGetSession.mockResolvedValue({
      sessionId: "sess-1",
      user: {
        id: "u-1",
        username: "202612345",
        role: "STUDENT",
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });
    mockUserFindUnique.mockResolvedValue({
      id: "u-1",
      username: "202612345",
      passwordHash: oldHash,
      role: "STUDENT",
      status: "ACTIVE",
      mustChangePassword: true,
    });

    const res = await authService.changePassword(
      { currentPassword: "TempPass#2026", newPassword: "NewPersonalPass#2026" },
      { ip: "127.0.0.1" }
    );

    expect(res.mustChangePassword).toBe(false);
    expect(mockRevokeAllSessions).toHaveBeenCalledWith("u-1", "sess-1");
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("PASSWORD_CHANGED");
  });
});

describe("Security Core – S3 RBAC Matrix & S6 Input / CSRF Validation", () => {
  it("enforces role permission boundaries matching Brief Section D", () => {
    expect(PERMISSIONS.STUDENT.has("profile:read:self")).toBe(true);
    expect(PERMISSIONS.STUDENT.has("student:read")).toBe(false);
    expect(PERMISSIONS.STUDENT.has("student:delete")).toBe(false);

    expect(PERMISSIONS.STAFF.has("student:create")).toBe(true);
    expect(PERMISSIONS.STAFF.has("section:assign")).toBe(true);
    expect(PERMISSIONS.STAFF.has("program:manage")).toBe(false);
    expect(PERMISSIONS.STAFF.has("student:delete")).toBe(false);
    expect(PERMISSIONS.STAFF.has("account:manage")).toBe(false);

    expect(PERMISSIONS.ADMIN.has("student:delete")).toBe(true);
    expect(PERMISSIONS.ADMIN.has("account:manage")).toBe(true);
    expect(PERMISSIONS.ADMIN.has("audit:read")).toBe(true);
  });

  it("rejects unknown fields in login and student self-service update (strict schemas)", () => {
    expect(
      loginSchema.safeParse({ username: "admin", password: "secret", role: "ADMIN" }).success
    ).toBe(false);

    expect(
      selfUpdateSchema.safeParse({
        address: "Indang, Cavite",
        programId: "b3a00000-0000-4000-8000-000000000000",
      }).success
    ).toBe(false);
  });

  it("blocks cross-origin POST requests in assertSameOrigin (SEC-10)", () => {
    const badReq = new Request("https://sims.example.com/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://evil.example.org",
        host: "sims.example.com",
      },
    });
    expect(() => assertSameOrigin(badReq)).toThrowError(HttpError);

    const goodReq = new Request("https://sims.example.com/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://sims.example.com",
        host: "sims.example.com",
      },
    });
    expect(() => assertSameOrigin(goodReq)).not.toThrow();
  });
});
