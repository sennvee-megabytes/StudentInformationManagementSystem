"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type ProgramItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: {
    students: number;
    sections: number;
  };
};

export function ProgramsManager({ initialPrograms }: { initialPrograms: ProgramItem[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          description: description.trim() ? description.trim() : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to create program.");
        return;
      }
      setCode("");
      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Network error while creating program.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(program: ProgramItem) {
    setError(null);
    const res = await fetch(`/api/programs/${program.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !program.isActive }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error?.message ?? "Failed to update program.");
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
        <h2 className="text-sm font-semibold text-slate-900">Add New Program / Course</h2>
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="code" className="block text-xs font-medium text-slate-700">
              Program Code
            </label>
            <input
              id="code"
              required
              placeholder="e.g. BSIT"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-xs font-medium text-slate-700">
              Program Name
            </label>
            <input
              id="name"
              required
              placeholder="e.g. Bachelor of Science in Information Technology"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="description" className="block text-xs font-medium text-slate-700">
              Description (Optional)
            </label>
            <input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {loading ? "Saving..." : "Add Program"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Program Name</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Sections</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {initialPrograms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No programs configured yet.
                </td>
              </tr>
            ) : (
              initialPrograms.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{p.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p._count.students}</td>
                  <td className="px-4 py-3 text-slate-600">{p._count.sections}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActive(p)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {p.isActive ? "Deactivate" : "Activate"}
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
