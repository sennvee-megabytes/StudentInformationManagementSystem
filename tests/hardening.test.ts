import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSessionFindUnique = vi.fn();
const mockSessionUpdate = vi.fn();
const mockSessionDeleteMany = vi.fn();
const mockAuditCreate = vi.fn();
const mockCookiesGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (...args: unknown[]) => mockCookiesGet(...args),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
      update: (...args: unknown[]) => mockSessionUpdate(...args),
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}));

import { getSession } from "@/lib/session";
import { requirePermission } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { middleware } from "@/middleware";
import { GET as cronPurgeSessions } from "@/app/api/cron/purge-sessions/route";

describe("Phase 7 – Hardening & SDD §11.3 Security Verification (SEC-01..SEC-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "super-secret-cron-token-12345";
  });

  it("SEC-03 / SEC-04: requirePermission blocks unauthorized role access and writes ACCESS_DENIED audit", async () => {
    mockCookiesGet.mockReturnValue({ value: "valid-token" });
    mockSessionFindUnique.mockResolvedValue({
      id: "sess-stu-1",
      revokedAt: null,
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
      user: {
        id: "user-stu-1",
        username: "202612345",
        role: "STUDENT",
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });

    await expect(requirePermission("student:read")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.action).toBe("ACCESS_DENIED");
    expect(mockAuditCreate.mock.calls[0]?.[0]?.data?.outcome).toBe("FAILURE");
  });

  it("SEC-06 / S4: middleware sets strict CSP with per-request nonce and redirects unauthenticated protected routes", () => {
    const unauthProtected = new NextRequest("http://localhost:3000/admin/students");
    const redirectRes = middleware(unauthProtected);
    expect(redirectRes.status).toBe(307);
    expect(redirectRes.headers.get("location")).toContain("/login");

    const publicReq = new NextRequest("http://localhost:3000/login");
    const pubRes = middleware(publicReq);
    const csp = pubRes.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("SEC-11 / S10: hardening.sql contains append-only audit_logs triggers and CHECK constraints", () => {
    const sqlPath = resolve(process.cwd(), "prisma/hardening.sql");
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toContain("audit_logs_block_mutation");
    expect(sql).toContain("BEFORE UPDATE OR DELETE ON audit_logs");
    expect(sql).toContain("BEFORE TRUNCATE ON audit_logs");
    expect(sql).toContain("users_username_lowercase");
    expect(sql).toContain("students_birth_date_past");
  });

  it("SEC-12 / S4: audit logger redacts password, passwordHash, temporaryPassword, and token keys", async () => {
    await audit({
      actorId: "u-1",
      actorRole: "ADMIN",
      action: "TEST_REDACTION",
      metadata: {
        username: "juan",
        password: "PlainSecretPassword",
        temporaryPassword: "TempPassword123",
        passwordHash: "$2a$12$secret",
        token: "raw-session-token",
      },
    });

    const savedMeta = mockAuditCreate.mock.calls[0]?.[0]?.data?.metadata;
    expect(savedMeta).toEqual({
      username: "juan",
      password: "[REDACTED]",
      temporaryPassword: "[REDACTED]",
      passwordHash: "[REDACTED]",
      token: "[REDACTED]",
    });
  });

  it("SEC-14 / A1: getSession revokes idle-expired session (>20 min) and writes SESSION_TIMEOUT to audit log", async () => {
    mockCookiesGet.mockReturnValue({ value: "idle-expired-token" });
    mockSessionFindUnique.mockResolvedValue({
      id: "sess-expired",
      revokedAt: null,
      lastSeenAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes idle (> 20m limit)
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      user: {
        id: "user-stu-2",
        username: "202654321",
        role: "STUDENT",
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });

    const session = await getSession();
    expect(session).toBeNull();
    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-expired" },
      })
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "user-stu-2",
          action: "SESSION_TIMEOUT",
        }),
      })
    );
  });

  it("SEC-15: /api/cron/purge-sessions rejects unauthenticated requests with 401 and purges when authorized", async () => {
    const unauthorizedReq = new Request("http://localhost:3000/api/cron/purge-sessions");
    const res401 = await cronPurgeSessions(unauthorizedReq);
    expect(res401.status).toBe(401);

    mockSessionDeleteMany.mockResolvedValue({ count: 7 });
    const authorizedReq = new Request("http://localhost:3000/api/cron/purge-sessions", {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });
    const res200 = await cronPurgeSessions(authorizedReq);
    expect(res200.status).toBe(200);
    expect(await res200.json()).toEqual({ purged: 7 });
  });
});
