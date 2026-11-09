import { requirePageRole } from "@/lib/authz";
import { programService } from "@/server/services/programs";
import { sectionService } from "@/server/services/sections";
import { reportQuerySchema, reportService } from "@/server/services/reports";
import { StudentReportsView } from "@/components/reports/student-reports-view";

export default async function StaffReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePageRole(["STAFF", "ADMIN"]);
  const rawParams = await searchParams;
  const cleaned = Object.fromEntries(
    Object.entries(rawParams).filter(([, v]) => v !== "" && v !== undefined)
  );
  const query = reportQuerySchema.parse({ ...cleaned, format: "json" });

  const [programs, sections, report] = await Promise.all([
    programService.list({ activeOnly: true }),
    sectionService.list({ activeOnly: true }),
    reportService.generateStudentReport(session, query),
  ]);

  return (
    <StudentReportsView
      basePath="/staff/reports"
      programs={programs}
      sections={sections}
      students={report.students}
      filters={query}
    />
  );
}
