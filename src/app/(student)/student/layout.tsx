import Link from "next/link";
import { requirePageRole } from "@/lib/authz";
import { isAcademicRecordsEnabled } from "@/server/services/profile";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageRole(["STUDENT"]);
  const showAcademic = isAcademicRecordsEnabled();

  const navItems = [
    { href: "/student", label: "Dashboard" },
    { href: "/student/profile", label: "My Profile" },
    { href: "/student/enrollment", label: "Enrollment" },
    ...(showAcademic ? [{ href: "/student/academic", label: "Academic Records" }] : []),
    { href: "/student/settings", label: "Account Security" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-6">
            <Link href="/student" className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
                SIMS
              </span>
              <span className="text-sm font-semibold text-slate-900">Student Portal</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
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
            <span className="font-mono text-xs font-medium text-slate-600">
              {session.user.username}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
