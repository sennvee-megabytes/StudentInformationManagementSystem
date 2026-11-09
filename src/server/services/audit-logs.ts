import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";

type Actor = {
  user: { id: string; role: Role };
};

export const auditLogQuerySchema = z.object({
  actor: z.string().trim().max(64).optional(),
  action: z.string().trim().max(64).optional(),
  entityType: z.string().trim().max(64).optional(),
  outcome: z.enum(["SUCCESS", "FAILURE"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  format: z.enum(["json", "csv"]).default("json"),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogService = {
  async list(query: AuditLogQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action && { action: { contains: query.action, mode: "insensitive" } }),
      ...(query.entityType && { entityType: { equals: query.entityType, mode: "insensitive" } }),
      ...(query.outcome && { outcome: query.outcome }),
      ...(query.actor && {
        actor: {
          username: { contains: query.actor.toLowerCase(), mode: "insensitive" },
        },
      }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(`${query.from}T00:00:00.000Z`) }),
          ...(query.to && { lte: new Date(`${query.to}T23:59:59.999Z`) }),
        },
      }),
    };

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: {
          actor: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
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

  async exportCsv(actor: Actor, query: AuditLogQuery, meta?: { ip?: string; userAgent?: string }) {
    const { items } = await this.list({ ...query, page: 1, pageSize: 100 });

    await audit({
      actorId: actor.user.id,
      actorRole: actor.user.role,
      action: "REPORT_GENERATED",
      entityType: "AuditLog",
      metadata: {
        reportType: "audit_logs",
        rowCount: items.length,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    const headers = [
      "Timestamp (ISO)",
      "Actor Username",
      "Actor Role",
      "Action",
      "Outcome",
      "Entity Type",
      "Entity ID",
      "IP Address",
      "Metadata",
    ];

    const rows = items.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.actor?.username ?? "system/anonymous",
      log.actorRole ?? "",
      log.action,
      log.outcome,
      log.entityType ?? "",
      log.entityId ?? "",
      log.ip ?? "",
      log.metadata ? JSON.stringify(log.metadata) : "",
    ]);

    return toCsv(headers, rows);
  },
};
