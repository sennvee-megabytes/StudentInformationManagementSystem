import { requirePageRole } from "@/lib/authz";
import { programService } from "@/server/services/programs";
import { sectionService } from "@/server/services/sections";
import { studentService } from "@/server/services/students";
import { StudentDetailManager } from "@/components/students/student-detail-manager";

export default async function StaffStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageRole(["STAFF", "ADMIN"]);
  const { id } = await params;
  const [student, programs, sections] = await Promise.all([
    studentService.getById(session, id),
    programService.list({ activeOnly: true }),
    sectionService.list({ activeOnly: true }),
  ]);

  return (
    <StudentDetailManager
      student={student}
      programs={programs}
      sections={sections}
      isAdmin={session.user.role === "ADMIN"}
      basePath="/staff/students"
    />
  );
}
