import Link from "next/link";
import { requirePageRole } from "@/lib/authz";
import { isAcademicRecordsEnabled, profileService } from "@/server/services/profile";

export default async function StudentDashboardPage() {
  const session = await requirePageRole(["STUDENT"]);
  const profile = await profileService.getOwnProfile(session);
  const showAcademic = isAcademicRecordsEnabled();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Student No. {profile.studentNumber}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {profile.lastName}, {profile.firstName} {profile.middleName ?? ""}{" "}
              {profile.suffix ?? ""}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {profile.program.code} – {profile.program.name}
            </p>
          </div>

          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              profile.enrollmentStatus === "ENROLLED"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {profile.enrollmentStatus}
          </span>
        </div>

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Course / Program</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{profile.program.code}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Year Level</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">Year {profile.yearLevel}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Assigned Section</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {profile.section
                ? `${profile.program.code} ${profile.yearLevel}-${profile.section.name} (${profile.section.schoolYear})`
                : "Unassigned"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Date Enrolled</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {profile.dateEnrolled
                ? new Date(profile.dateEnrolled).toLocaleDateString("en-PH")
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/student/profile"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-600"
        >
          <h2 className="text-sm font-semibold text-slate-900">My Profile & Contact Info</h2>
          <p className="mt-1 text-xs text-slate-600">
            View your official student record and update your mobile number, address, email, and
            guardian details.
          </p>
        </Link>

        <Link
          href="/student/enrollment"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-600"
        >
          <h2 className="text-sm font-semibold text-slate-900">Enrollment History</h2>
          <p className="mt-1 text-xs text-slate-600">
            Review your term-by-term enrollment status, year level, and assigned section.
          </p>
        </Link>

        {showAcademic ? (
          <Link
            href="/student/academic"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-600"
          >
            <h2 className="text-sm font-semibold text-slate-900">Academic Information</h2>
            <p className="mt-1 text-xs text-slate-600">
              View your encoded subjects, units, grades, and remarks per semester.
            </p>
          </Link>
        ) : (
          <Link
            href="/student/settings"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-600"
          >
            <h2 className="text-sm font-semibold text-slate-900">Account Security</h2>
            <p className="mt-1 text-xs text-slate-600">
              Update your account password and review security guidelines.
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
