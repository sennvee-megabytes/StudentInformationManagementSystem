import { requirePageRole } from "@/lib/authz";
import { programService } from "@/server/services/programs";
import { ProgramsManager } from "@/components/admin/programs-manager";

export default async function AdminProgramsPage() {
  await requirePageRole(["ADMIN"]);
  const programs = await programService.list();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Programs & Courses</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create and manage academic degree programs offered by the institution.
        </p>
      </div>
      <ProgramsManager initialPrograms={programs} />
    </div>
  );
}
