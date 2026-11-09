import { Prisma, Role, Outcome } from "@prisma/client";
import { prisma } from "@/lib/db";

const REDACT = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "passwordHash",
  "temporaryPassword",
  "token",
]);

function redact(obj?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!obj) return undefined;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, REDACT.has(k) ? "[REDACTED]" : v])
  ) as Prisma.InputJsonValue;
}

export type AuditInput = {
  actorId?: string | null;
  actorRole?: Role | null;
  action: string; // e.g. LOGIN_SUCCESS, STUDENT_UPDATED
  entityType?: string;
  entityId?: string;
  outcome?: Outcome;
  metadata?: Record<string, unknown>; // store changed FIELD NAMES, not sensitive values
  ip?: string | null;
  userAgent?: string | null;
};

export async function audit(
  e: AuditInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  await tx.auditLog.create({
    data: {
      actorId: e.actorId ?? null,
      actorRole: e.actorRole ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      outcome: e.outcome ?? "SUCCESS",
      metadata: redact(e.metadata),
      ip: e.ip ?? null,
      userAgent: e.userAgent?.slice(0, 255) ?? null,
    },
  });
}
