import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/authz";

export default async function StaffDashboardPage() {
  await requirePageRole(["STAFF", "ADMIN"]);

  const [totalStudents, enrolledStudents, activePrograms, activeSections] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.student.count({ where: { deletedAt: null, enrollmentStatus: "ENROLLED" } }),
    prisma.program.count({ where: { isActive: true } }),
    prisma.section.count({ where: { isActive: true } }),
  ]);

  const cards = [
    { label: "Total Registered Students", value: totalStudents, href: "/staff/students" },
    { label: "Currently Enrolled", value: enrolledStudents, href: "/staff/students" },
    { label: "Active Programs", value: activePrograms, href: "/staff/students" },
    { label: "Active Sections", value: activeSections, href: "/staff/students" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registrar Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Register students, maintain profiles, manage term enrollment, and generate class lists.
          </p>
        </div>
        <Link
          href="/staff/students/new"
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-emerald-800"
        >
          + Register New Student
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-600"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{c.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
