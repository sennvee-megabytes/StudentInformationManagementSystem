"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type ProgramOption = {
  id: string;
  code: string;
  name: string;
};

type SectionItem = {
  id: string;
  programId: string;
  yearLevel: number;
  name: string;
  schoolYear: string;
  capacity: number | null;
  isActive: boolean;
  program: { id: string; code: string; name: string };
  _count: { students: number };
};

export function SectionsManager({
  programs,
  initialSections,
}: {
  programs: ProgramOption[];
  initialSections: SectionItem[];
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [yearLevel, setYearLevel] = useState(1);
  const [name, setName] = useState("A");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [capacity, setCapacity] = useState("40");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          yearLevel: Number(yearLevel),
          name: name.trim(),
          schoolYear: schoolYear.trim(),
          capacity: capacity.trim() ? Number(capacity) : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to create section.");
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError("Network error while creating section.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(sec: SectionItem) {
    setError(null);
    const res = await fetch(`/api/sections/${sec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !sec.isActive }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error?.message ?? "Failed to update section.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <h2 className="text-sm font-semibold text-slate-900">Add New Section</h2>
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label htmlFor="programId" className="block text-xs font-medium text-slate-700">
              Program
            </label>
            <select
              id="programId"
              required
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} – {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="yearLevel" className="block text-xs font-medium text-slate-700">
              Year Level
            </label>
            <select
              id="yearLevel"
              value={yearLevel}
              onChange={(e) => setYearLevel(Number(e.target.value))}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-slate-700">
              Section Name
            </label>
            <input
              id="name"
              required
              placeholder="e.g. A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="schoolYear" className="block text-xs font-medium text-slate-700">
              School Year
            </label>
            <input
              id="schoolYear"
              required
              placeholder="2026-2027"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="capacity" className="block text-xs font-medium text-slate-700">
              Capacity
            </label>
            <input
              id="capacity"
              type="number"
              min={1}
              max={500}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading || programs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {loading ? "Saving..." : "Add Section"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">School Year</th>
              <th className="px-4 py-3">Assigned / Capacity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {initialSections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No sections configured yet.
                </td>
              </tr>
            ) : (
              initialSections.map((sec) => (
                <tr key={sec.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {sec.program.code} {sec.yearLevel}-{sec.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sec.program.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{sec.schoolYear}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {sec._count.students} / {sec.capacity ?? "∞"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        sec.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {sec.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActive(sec)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {sec.isActive ? "Deactivate" : "Activate"}
                    </button>
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
