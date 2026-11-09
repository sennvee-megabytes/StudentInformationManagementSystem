import { requirePageRole } from "@/lib/authz";
import { programService } from "@/server/services/programs";
import { sectionService } from "@/server/services/sections";
import { StudentRegistrationForm } from "@/components/students/student-registration-form";

export default async function StaffNewStudentPage() {
  await requirePageRole(["STAFF", "ADMIN"]);
  const [programs, sections] = await Promise.all([
    programService.list({ activeOnly: true }),
    sectionService.list({ activeOnly: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Register New Student</h1>
        <p className="mt-1 text-sm text-slate-600">
          Creates the student profile, records initial term enrollment, and provisions a student
          login account with a one-time temporary password.
        </p>
      </div>
      <StudentRegistrationForm
        programs={programs}
        sections={sections}
        basePath="/staff/students"
      />
    </div>
  );
}
