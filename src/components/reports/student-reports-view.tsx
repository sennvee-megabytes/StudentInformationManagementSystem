"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";

type ProgramOption = { id: string; code: string; name: string };
type SectionOption = {
  id: string;
  programId: string;
  yearLevel: number;
  name: string;
  schoolYear: string;
};

type StudentReportRow = {
  id: string;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  sex: string;
  yearLevel: number;
  enrollmentStatus: string;
  contactNumber: string | null;
  personalEmail: string | null;
  program: { code: string; name: string };
  section: { name: string; schoolYear: string } | null;
};

export function StudentReportsView({
  basePath,
  programs,
  sections,
  students,
  filters,
}: {
  basePath: "/staff/reports" | "/admin/reports";
  programs: ProgramOption[];
  sections: SectionOption[];
  students: StudentReportRow[];
  filters: {
    programId?: string;
    yearLevel?: number;
    sectionId?: string;
    status?: string;
  };
}) {
  const [selectedProgram, setSelectedProgram] = useState(filters.programId ?? "");
  const [selectedYear, setSelectedYear] = useState(filters.yearLevel ? String(filters.yearLevel) : "");
  const [selectedSection, setSelectedSection] = useState(filters.sectionId ?? "");
  const [selectedStatus, setSelectedStatus] = useState(filters.status ?? "");

  const csvParams = new URLSearchParams();
  if (filters.programId) csvParams.set("programId", filters.programId);
  if (filters.yearLevel) csvParams.set("yearLevel", String(filters.yearLevel));
  if (filters.sectionId) csvParams.set("sectionId", filters.sectionId);
  if (filters.status) csvParams.set("status", filters.status);
  csvParams.set("format", "csv");

  const filteredSections = sections.filter(
    (s) =>
      (!selectedProgram || s.programId === selectedProgram) &&
      (!selectedYear || s.yearLevel === Number(selectedYear))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Reports & Rosters</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate filtered student lists, section rosters, CSV exports, and printable reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={`/api/reports/students?${csvParams.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      <form
        method="GET"
        action={basePath}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-5 print:hidden"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">Program</label>
          <select
            name="programId"
            value={selectedProgram}
            onChange={(e) => {
              setSelectedProgram(e.target.value);
              setSelectedSection("");
            }}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} – {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Year Level</label>
          <select
            name="yearLevel"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedSection("");
            }}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Year Levels</option>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Section</label>
          <select
            name="sectionId"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Sections</option>
            {filteredSections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name} ({s.schoolYear})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Enrollment Status</label>
          <select
            name="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="NOT_ENROLLED">Not Enrolled</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="GRADUATED">Graduated</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </div>

        <div className="flex items-end justify-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Apply Filters
          </button>
        </div>
      </form>

      <div className="hidden border-b border-slate-300 pb-4 print:block">
        <p className="text-xs font-semibold uppercase text-slate-600">
          Cavite State University – Don Severino de las Alas Campus
        </p>
        <h1 className="text-lg font-bold text-slate-900">
          Student Information Management System – Official Student Report
        </h1>
        <p className="text-xs text-slate-500">
          Total Records: {students.length} · Generated on {new Date().toLocaleDateString("en-PH")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs print:border-0 print:shadow-none">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Student No.</th>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Sex</th>
              <th className="px-4 py-3">Program & Year</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  No student records match the selected filters.
                </td>
              </tr>
            ) : (
              students.map((s, idx) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                    {s.studentNumber}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {s.lastName}, {s.firstName} {s.middleName ?? ""} {s.suffix ?? ""}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{s.sex}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {s.program.code} – Year {s.yearLevel}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {s.section ? `${s.program.code} ${s.yearLevel}-${s.section.name}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-700">
                    {s.enrollmentStatus}
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
