import { requirePageRole } from "@/lib/authz";
import { programService } from "@/server/services/programs";
import { sectionService } from "@/server/services/sections";
import { SectionsManager } from "@/components/admin/sections-manager";

export default async function AdminSectionsPage() {
  await requirePageRole(["ADMIN"]);
  const [programs, sections] = await Promise.all([
    programService.list({ activeOnly: true }),
    sectionService.list(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Year Levels & Sections</h1>
        <p className="mt-1 text-sm text-slate-600">
          Organize sections per program, year level, school year, and capacity.
        </p>
      </div>
      <SectionsManager programs={programs} initialSections={sections} />
    </div>
  );
}
