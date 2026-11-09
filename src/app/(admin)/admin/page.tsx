import Link from "next/link";
import { requirePageRole } from "@/lib/authz";
import { dashboardService } from "@/server/services/dashboard";

export default async function AdminDashboardPage() {
  await requirePageRole(["ADMIN"]);
  const stats = await dashboardService.getAdminStats();

  const cards = [
    { label: "Total Registered Students", value: stats.totalStudents, href: "/admin/students" },
    { label: "Currently Enrolled", value: stats.enrolledStudents, href: "/admin/students" },
    { label: "Active Accounts", value: stats.activeAccounts, href: "/admin/accounts" },
    { label: "Locked Accounts", value: stats.lockedAccounts, href: "/admin/accounts" },
  ];

  const maxProgramCount = Math.max(1, ...stats.byProgram.map((p) => p.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administrator Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Centralized student statistics, program breakdown, and real-time security activity.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/students/new"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
          >
            + Register Student
          </Link>
          <Link
            href="/admin/reports"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Generate Reports
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-600"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Students by Program / Course</h2>
            <Link href="/admin/programs" className="text-xs font-medium text-emerald-700">
              Manage Programs →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {stats.byProgram.length === 0 ? (
              <p className="py-4 text-xs text-slate-500">No programs configured yet.</p>
            ) : (
              stats.byProgram.map((p) => (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {p.code} – {p.name}
                    </span>
                    <span className="font-mono font-semibold text-slate-900">{p.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${Math.round((p.count / maxProgramCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent System Activity</h2>
            <Link href="/admin/logs" className="text-xs font-medium text-emerald-700">
              View All Logs →
            </Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100 text-xs">
            {stats.recentAuditLogs.length === 0 ? (
              <p className="py-4 text-slate-500">No activity recorded yet.</p>
            ) : (
              stats.recentAuditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-mono font-semibold text-slate-900">{log.action}</span>
                    <span className="ml-2 text-slate-500">
                      by {log.actor?.username ?? "system"}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString("en-PH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
