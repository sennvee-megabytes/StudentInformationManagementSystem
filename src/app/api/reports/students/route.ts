import { requirePermission } from "@/lib/authz";
import { getRequestMeta, handle, ok } from "@/lib/http";
import { reportQuerySchema, reportService } from "@/server/services/reports";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requirePermission("report:generate");
    const { searchParams } = new URL(req.url);
    const cleaned = Object.fromEntries(
      Array.from(searchParams.entries()).filter(([, v]) => v !== "")
    );
    const query = reportQuerySchema.parse(cleaned);
    const report = await reportService.generateStudentReport(session, query, getRequestMeta(req));

    if (query.format === "json") {
      return ok(report.students, { meta: { rowCount: report.rowCount } });
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    return new Response(report.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sims-students-${dateStamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
