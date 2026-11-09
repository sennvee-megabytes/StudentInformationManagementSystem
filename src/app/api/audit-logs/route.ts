import { requirePermission } from "@/lib/authz";
import { getRequestMeta, handle, ok } from "@/lib/http";
import { auditLogQuerySchema, auditLogService } from "@/server/services/audit-logs";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requirePermission("audit:read");
    const { searchParams } = new URL(req.url);
    const cleaned = Object.fromEntries(
      Array.from(searchParams.entries()).filter(([, v]) => v !== "")
    );
    const query = auditLogQuerySchema.parse(cleaned);

    if (query.format === "csv") {
      const csv = await auditLogService.exportCsv(session, query, getRequestMeta(req));
      const dateStamp = new Date().toISOString().slice(0, 10);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="sims-audit-logs-${dateStamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const result = await auditLogService.list(query);
    return ok(result.items, { meta: result.meta });
  });
}
