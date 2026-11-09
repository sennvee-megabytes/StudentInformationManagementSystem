import Link from "next/link";
import { requirePageRole } from "@/lib/authz";
import { LogoutButton } from "@/components/auth/logout-button";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/accounts", label: "Student Accounts" },
  { href: "/admin/programs", label: "Programs" },
  { href: "/admin/sections", label: "Sections" },
  { href: "/admin/staff", label: "Staff & Roles" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/logs", label: "Activity Logs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageRole(["ADMIN"]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
                SIMS
              </span>
              <span className="text-sm font-semibold text-slate-900">Administrator</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/change-password"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              {session.user.username}
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
