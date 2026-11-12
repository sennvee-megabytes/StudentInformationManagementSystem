import Link from "next/link";
import { Plus, Search } from "lucide-react";

type StudentRow = {
  id: string;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  yearLevel: number;
  enrollmentStatus: string;
  deletedAt: Date | null;
  program: { id: string; code: string; name: string };
  section: { id: string; name: string; yearLevel: number; schoolYear: string } | null;
};

type ProgramOption = {
  id: string;
  code: string;
  name: string;
};

export function StudentListView({
  basePath,
  isAdmin,
  programs,
  items,
  meta,
  filters,
}: {
  basePath: "/staff/students" | "/admin/students";
  isAdmin?: boolean;
  programs: ProgramOption[];
  items: StudentRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  filters: {
    q?: string;
    programId?: string;
    yearLevel?: number;
    status?: string;
    includeDeleted?: boolean;
  };
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Records</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search, filter, register, and maintain centralized student information ({meta.total}{" "}
            total).
          </p>
        </div>
        <Link
          href={`${basePath}/new`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          Register New Student
        </Link>
      </div>

      <form
        method="GET"
        action={basePath}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-6"
      >
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search name or student no..."
            className="block w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div>
          <select
            name="programId"
            defaultValue={filters.programId ?? ""}
            className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            name="yearLevel"
            defaultValue={filters.yearLevel ?? ""}
            className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
          >
            <option value="">All Years</option>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="NOT_ENROLLED">Not Enrolled</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="GRADUATED">Graduated</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2">
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                name="includeDeleted"
                value="true"
                defaultChecked={filters.includeDeleted}
                className="rounded border-slate-300 text-emerald-700"
              />
              Deleted
            </label>
          )}
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Student No.</th>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Program & Year</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No matching student records found.
                </td>
              </tr>
            ) : (
              items.map((st) => (
                <tr key={st.id} className={st.deletedAt ? "bg-red-50/40" : undefined}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                    {st.studentNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {st.lastName}, {st.firstName} {st.middleName ? `${st.middleName[0]}.` : ""}{" "}
                    {st.suffix ?? ""}
                    {st.deletedAt && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        DELETED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {st.program.code} – Year {st.yearLevel}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {st.section ? `${st.program.code} ${st.yearLevel}-${st.section.name}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        st.enrollmentStatus === "ENROLLED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {st.enrollmentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <Link
                        href={`${basePath}/${st.id}#academic-records`}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                      >
                        Subjects / Grades
                      </Link>
                      <Link
                        href={`${basePath}/${st.id}`}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View / Edit
                      </Link>
                    </div>
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
