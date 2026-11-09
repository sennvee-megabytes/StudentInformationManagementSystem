import { requirePageRole } from "@/lib/authz";
import { profileService } from "@/server/services/profile";

export default async function StudentEnrollmentPage() {
  const session = await requirePageRole(["STUDENT"]);
  const { student, enrollments } = await profileService.getOwnEnrollments(session);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Enrollment Information</h1>
        <p className="mt-1 text-sm text-slate-600">
          Student No. <span className="font-mono font-semibold">{student.studentNumber}</span> ·
          Current Status:{" "}
          <span className="font-semibold text-emerald-700">{student.enrollmentStatus}</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">School Year</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3">Program / Course</th>
              <th className="px-4 py-3">Year Level</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No enrollment records found.
                </td>
              </tr>
            ) : (
              enrollments.map((en) => (
                <tr key={en.id}>
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">
                    {en.schoolYear}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{en.semester}</td>
                  <td className="px-4 py-3 text-slate-800">
                    {en.program.code} – {en.program.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">Year {en.yearLevel}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {en.section ? `${en.program.code} ${en.yearLevel}-${en.section.name}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {en.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
