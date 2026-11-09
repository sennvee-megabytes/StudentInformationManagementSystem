import { requirePageRole } from "@/lib/authz";
import { programService } from "@/server/services/programs";
import { studentService } from "@/server/services/students";
import { studentListQuerySchema } from "@/validation/student";
import { StudentListView } from "@/components/students/student-list-view";

export default async function StaffStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePageRole(["STAFF", "ADMIN"]);
  const rawParams = await searchParams;
  const cleaned = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => v !== "" && v !== undefined));
  const query = studentListQuerySchema.parse(cleaned);

  const [programs, result] = await Promise.all([
    programService.list({ activeOnly: true }),
    studentService.list(session, query),
  ]);

  return (
    <StudentListView
      basePath="/staff/students"
      programs={programs}
      items={result.items}
      meta={result.meta}
      filters={query}
    />
  );
}
