import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/authz";
import { isAcademicRecordsEnabled, profileService } from "@/server/services/profile";

export default async function StudentAcademicPage() {
  const session = await requirePageRole(["STUDENT"]);
  if (!isAcademicRecordsEnabled()) {
    notFound();
  }

  const records = await profileService.getOwnAcademicRecords(session);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Academic Information</h1>
        <p className="mt-1 text-sm text-slate-600">
          Subjects, units, grades, and remarks encoded for your student record.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Term</th>
              <th className="px-4 py-3">Subject Code</th>
              <th className="px-4 py-3">Descriptive Title</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No academic subject records have been encoded for your profile yet.
                </td>
              </tr>
            ) : (
              records.map((rec) => (
                <tr key={rec.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {rec.schoolYear} · {rec.semester}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                    {rec.subjectCode}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{rec.subjectTitle}</td>
                  <td className="px-4 py-3 text-slate-600">{String(rec.units)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{rec.grade ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{rec.remarks ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
